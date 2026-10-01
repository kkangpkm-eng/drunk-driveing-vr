import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { box, paint } from "../scene/geometryUtils.js";
import { roadCenterX, roadHeadingAt } from "../scene/road.js";

// 앞차 급정거 돌발 상황.
// 운전자가 spawnWhenPlayerZ를 지나면 같은 차로 앞쪽에 나타나 느리게 달리다(운전자가 따라붙게)
// 차간 거리 followGapM을 유지하며 달리고, brakeAtZ에서 급정거 → 잠시 정지 → 다시 출발해 사라진다.
// 앞차도 신호를 지킨다(전방 정지선 신호가 녹색이 아니면 정지선 앞에 선다).
// 일반/음주 모드 모두 같은 위치·같은 규칙으로 동작한다.
export class LeadCar {
  constructor(scene, config) {
    this.cfg = config.leadCar;
    this.vehicleCfg = config.vehicle;
    this.totalLengthM = config.road.totalLengthM;
    const { mesh, brakeMat } = createSedan(this.cfg);
    this.mesh = mesh;
    this.brakeMat = brakeMat;
    scene.add(mesh);
    this.listeners = { brake: [] };
    this.reset();
  }

  on(event, fn) {
    this.listeners[event].push(fn);
  }

  reset() {
    this.state = "inactive"; // inactive → driving → braking → stopped → resuming → gone
    this.z = 0;
    this.x = 0;
    this.speedMps = 0;
    this.holdTimer = 0;
    this.collisionCooldown = 0;
    this.mesh.visible = false;
    this._setBrakeLights(false);
  }

  get active() {
    return this.state !== "inactive" && this.state !== "gone";
  }

  // player: { x, z, heading, speedMps }, signals: TrafficSignalController[]
  // 반환: 이번 프레임에 추돌이 일어났으면 { overlapM, leadSpeedMps }, 아니면 null
  update(dt, player, signals) {
    const c = this.cfg;
    if (!c.enabled) return null;

    if (this.state === "inactive") {
      if (player.z < c.spawnWhenPlayerZ) return null;
      this.state = "driving";
      this.z = player.z + c.spawnAheadM;
      this.speedMps = c.approachSpeedKmh / 3.6;
      this.mesh.visible = true;
    }
    if (this.state === "gone") return null;

    const halfL = c.lengthM / 2;
    const playerFrontZ = player.z + Math.cos(player.heading) * this.vehicleCfg.frontOffsetM;
    const gap = this.z - halfL - playerFrontZ;

    let targetMps = this.speedMps;
    let accelLimit = c.accelMps2;

    if (this.state === "driving") {
      if (this.z >= c.brakeAtZ) {
        this.state = "braking";
        this._setBrakeLights(true);
        this.listeners.brake.forEach((fn) => fn({ gapM: gap, leadSpeedMps: this.speedMps }));
      } else if (gap > c.followGapM * 1.5) {
        targetMps = c.approachSpeedKmh / 3.6;
      } else {
        // 차간 거리 유지: 가까우면 빨리, 멀면 천천히 → 대략 followGapM에서 운전자 속도에 맞춰진다
        targetMps = THREE.MathUtils.clamp(player.speedMps + 0.5 * (gap - c.followGapM), c.minSpeedKmh / 3.6, c.maxSpeedKmh / 3.6);
      }
    }

    if (this.state === "braking") {
      this.speedMps = Math.max(0, this.speedMps - c.brakeDecelMps2 * dt);
      if (this.speedMps === 0) {
        this.state = "stopped";
        this.holdTimer = c.stopHoldS;
      }
    } else if (this.state === "stopped") {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.state = "resuming";
        this._setBrakeLights(false);
      }
    } else {
      if (this.state === "resuming") targetMps = c.resumeSpeedKmh / 3.6;
      // 신호 준수: 전방 정지선 신호가 녹색이 아니면 정지선 앞에서 멈출 수 있는 속도로 제한
      const frontZ = this.z + halfL;
      for (const s of signals) {
        const dist = s.stopLineZ - frontZ;
        if (dist > -0.5 && dist < 60 && s.displayState !== "green") {
          targetMps = Math.min(targetMps, Math.sqrt(2 * 4 * Math.max(0, dist - 1)));
          accelLimit = 6;
        }
      }
      const dv = THREE.MathUtils.clamp(targetMps - this.speedMps, -accelLimit * dt, accelLimit * dt);
      this.speedMps = Math.max(0, this.speedMps + dv);
      this._setBrakeLights(dv < -c.accelMps2 * dt * 0.9 || this.speedMps < 0.3);
    }

    this.z += this.speedMps * dt;
    this.x = roadCenterX(this.z) + c.laneOffsetM;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = roadHeadingAt(this.z);

    if (this.z - player.z > c.despawnAheadM || this.z > this.totalLengthM + 40) {
      this.state = "gone";
      this.mesh.visible = false;
      return null;
    }

    // 추돌 판정 (도로 진행 방향 기준 단순 직사각형)
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    const playerFrontX = player.x + Math.sin(player.heading) * this.vehicleCfg.frontOffsetM;
    const lateralOverlap = Math.abs(playerFrontX - this.x) < c.widthM / 2 + this.vehicleCfg.halfWidthM;
    const rearZ = this.z - halfL;
    if (lateralOverlap && playerFrontZ >= rearZ && playerFrontZ < this.z + halfL) {
      const hit = this.collisionCooldown <= 0 && player.speedMps > this.speedMps + 0.3;
      if (hit) this.collisionCooldown = 2;
      return { overlapM: playerFrontZ - rearZ, leadSpeedMps: this.speedMps, newHit: hit };
    }
    return null;
  }

  _setBrakeLights(on) {
    this.brakeMat.emissiveIntensity = on ? 2.5 : 0.15;
  }
}

// 승용차 (차체/유리/바퀴는 버텍스 컬러로 병합한 메시 1개 + 브레이크등 메시 1개)
function createSedan(c) {
  const L = c.lengthM;
  const W = c.widthM;
  const parts = [
    paint(box(W, 0.7, L, 0, 0.68, 0), c.bodyColor),
    paint(box(W * 0.88, 0.5, L * 0.48, 0, 1.28, -0.15), 0x1d2630),
    paint(box(W * 0.84, 0.06, L * 0.4, 0, 1.55, -0.2), c.bodyColor),
    paint(box(W * 0.9, 0.18, 0.06, 0, 0.5, -L / 2 - 0.02), 0x222222), // 뒤 범퍼
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(sx * (W / 2 - 0.08), 0.33, sz * L * 0.32);
      parts.push(paint(wheel, 0x151515));
    }
  }
  const group = new THREE.Group();
  group.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })));

  // 브레이크등 (뒤쪽 양 끝 + 가운데 보조등)
  const lights = [
    box(0.38, 0.14, 0.05, -W / 2 + 0.25, 0.86, -L / 2 - 0.02),
    box(0.38, 0.14, 0.05, W / 2 - 0.25, 0.86, -L / 2 - 0.02),
    box(0.5, 0.05, 0.04, 0, 1.5, -L * 0.42),
  ];
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1010, emissiveIntensity: 0.15 });
  group.add(new THREE.Mesh(mergeGeometries(lights), brakeMat));
  return { mesh: group, brakeMat };
}
