import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

// intersection.js의 보도 블록 높이와 같은 값
export const SIDEWALK_PAD_HEIGHT_M = 0.15;

const MODEL_DIR = `${import.meta.env.BASE_URL}models/pedestrians/`;

// 횡단보도 보행자. 적색 신호가 켜지면(onRed) 각자 delayAfterRedS 뒤에 walkSpeedMps로 길을 건넌다.
// 모델: Kenney "Mini Characters" (CC0) glTF의 idle/walk 애니메이션.
// 로드 실패 또는 useGltf=false면 기본 도형 캐릭터(사인파 팔다리)로 대체한다.
export class PedestrianManager {
  constructor(scene, config, layout) {
    this.cfg = config.pedestrians;
    this.vehicleCfg = config.vehicle;
    this.layout = layout;
    this.roadHalfWidthM = config.road.halfWidthM;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.peds = [];
    this.redActive = false;
    this.redTime = 0;
    this.ready = this._spawnAll();
  }

  async _spawnAll() {
    const templates = new Map();
    if (this.cfg.useGltf) {
      const loader = new GLTFLoader();
      for (const name of new Set(this.cfg.list.map((p) => p.model))) {
        try {
          templates.set(name, await loader.loadAsync(MODEL_DIR + name));
        } catch (err) {
          console.warn(`[pedestrians] ${name} 로드 실패 → 기본 도형 캐릭터로 대체`, err);
        }
      }
    }
    this.cfg.list.forEach((spec, i) => {
      const gltf = templates.get(spec.model);
      const visual = gltf ? createGltfVisual(gltf, this.cfg) : createPrimitiveVisual(i, this.cfg.heightM);
      this.peds.push(this._makePed(spec, visual));
    });
    // 로딩 중에 이미 적색이 켜졌을 수 있으므로 신호 상태는 유지한 채 위치만 초기화
    const { redActive, redTime } = this;
    this.reset();
    this.redActive = redActive;
    this.redTime = redTime;
  }

  _makePed(spec, visual) {
    const L = this.layout;
    const edge = this.roadHalfWidthM + this.cfg.waitOffsetFromRoadEdgeM;
    const sideSign = spec.startSide === "left" ? 1 : -1; // 운전자 오른쪽 = -X
    const root = new THREE.Group();
    root.add(visual.object);
    this.group.add(root);
    return {
      spec,
      root,
      visual,
      startX: L.cx + sideSign * edge,
      endX: L.cx - sideSign * edge,
      dir: -sideSign, // 걷는 방향 (+1 = +X)
      z: L.crosswalkNearZ + spec.offsetInCrosswalkM,
      x: 0,
      state: "waiting",
      blocked: false,
    };
  }

  reset() {
    this.redActive = false;
    this.redTime = 0;
    for (const p of this.peds) {
      p.x = p.startX;
      p.state = "waiting";
      p.blocked = false;
      p.root.visible = true;
      p.root.position.set(p.x, SIDEWALK_PAD_HEIGHT_M, p.z);
      p.root.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; // 모델 정면(+Z)을 건너갈 방향으로
      p.visual.setWalking(false);
    }
  }

  onRed() {
    this.redActive = true;
    this.redTime = 0;
  }

  // 개발/스크린샷용: 적색 이후 seconds초가 지난 상태로 즉시 이동
  skipAhead(seconds, step = 1 / 30) {
    for (let t = 0; t < seconds; t += step) this.update(step, null);
  }

  // car: { x, z, heading, speedMps } — 충돌한 보행자 수를 반환
  update(dt, car) {
    let hits = 0;
    if (this.redActive) this.redTime += dt;
    const speed = this.cfg.walkSpeedMps;

    for (const p of this.peds) {
      if (p.state === "hit") continue;

      if (p.state === "waiting" && this.redActive && this.redTime >= p.spec.delayAfterRedS) {
        p.state = "walking";
      }

      if (p.state === "walking") {
        const nextX = p.x + p.dir * speed * dt;
        // 차가 (거의) 멈춰서 앞을 막고 있으면 충돌로 치지 않고 보행자가 기다린다.
        p.blocked = car !== null && car.speedMps < this.cfg.blockedMinCarSpeedMps && this._overlaps(car, nextX, p.z, 0.3);
        if (!p.blocked) p.x = nextX;
        if ((p.dir > 0 && p.x >= p.endX) || (p.dir < 0 && p.x <= p.endX)) {
          p.x = p.endX;
          p.state = "done";
        }
      }

      if (car && this._overlaps(car, p.x, p.z, 0) && car.speedMps >= this.cfg.blockedMinCarSpeedMps) {
        p.state = "hit";
        p.root.visible = false; // 사실적 묘사 없이 장면에서 제거 (점멸+경고음으로만 표현)
        hits++;
        continue;
      }

      p.root.position.x = p.x;
      // 보도 블록 위에서는 블록 높이만큼 올린다
      p.root.position.y = Math.abs(p.x - this.layout.cx) > this.roadHalfWidthM ? SIDEWALK_PAD_HEIGHT_M : 0;
      p.visual.setWalking(p.state === "walking" && !p.blocked);
      p.visual.update(dt);
    }
    return hits;
  }

  // 차량 직사각형(운전자 위치 기준 앞/뒤/좌우 오프셋)과 보행자 원의 겹침 판정
  _overlaps(car, px, pz, extra) {
    const v = this.vehicleCfg;
    const r = this.cfg.collisionRadiusM + extra;
    const dx = px - car.x;
    const dz = pz - car.z;
    const s = Math.sin(car.heading);
    const c = Math.cos(car.heading);
    const lon = dx * s + dz * c; // 전방 거리
    const lat = dx * c - dz * s; // 좌우 거리
    return lon > -v.rearOffsetM - r && lon < v.frontOffsetM + r && Math.abs(lat) < v.halfWidthM + r;
  }
}

// ── glTF 캐릭터 ──────────────────────────────────────────────

function createGltfVisual(gltf, cfg) {
  const object = cloneSkinned(gltf.scene);
  object.traverse((o) => {
    if (o.isSkinnedMesh) o.frustumCulled = false; // 스케일 후 바운딩이 어긋나 사라지는 문제 방지
  });
  // 모델 원래 키를 측정해서 cfg.heightM에 맞춘다
  object.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  if (size.y > 0) object.scale.setScalar(cfg.heightM / size.y);

  const mixer = new THREE.AnimationMixer(object);
  const clip = (name) => THREE.AnimationClip.findByName(gltf.animations, name);
  const idle = mixer.clipAction(clip("idle") ?? gltf.animations[0]);
  const walk = mixer.clipAction(clip("walk") ?? gltf.animations[0]);
  walk.timeScale = cfg.walkAnimTimeScale;
  idle.play();
  let walking = false;

  return {
    object,
    setWalking(on) {
      if (on === walking) return;
      walking = on;
      const [from, to] = on ? [idle, walk] : [walk, idle];
      to.reset().play();
      from.crossFadeTo(to, 0.25, false);
    },
    update(dt) {
      mixer.update(dt);
    },
  };
}

// ── 기본 도형 캐릭터 (대체용) ─────────────────────────────────

const SHIRT_COLORS = [0x3b6fb6, 0xc0563f, 0x4f8f4a, 0x8a5bb0];

function createPrimitiveVisual(index, heightM) {
  const s = heightM / 1.7;
  const object = new THREE.Group();
  object.scale.setScalar(s);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0b48f, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRT_COLORS[index % SHIRT_COLORS.length], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2f3a, roughness: 0.9 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.6, 0.24), shirt);
  torso.position.y = 1.18;
  object.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), skin);
  head.position.y = 1.62;
  object.add(head);

  // 팔다리는 관절(어깨/엉덩이)을 피벗으로 회전시키기 위해 그룹 안에 아래로 매단다
  const limb = (w, len, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
    m.position.y = -len / 2;
    pivot.add(m);
    object.add(pivot);
    return pivot;
  };
  const armL = limb(0.1, 0.58, shirt, 0.27, 1.46);
  const armR = limb(0.1, 0.58, shirt, -0.27, 1.46);
  const legL = limb(0.14, 0.88, pants, 0.11, 0.88);
  const legR = limb(0.14, 0.88, pants, -0.11, 0.88);

  let walking = false;
  let phase = 0;
  const strideHz = 1.8; // 1.3m/s 보행 시 대략적인 걸음 주기

  return {
    object,
    setWalking(on) {
      walking = on;
    },
    update(dt) {
      if (walking) phase += dt * strideHz * Math.PI * 2;
      else phase *= Math.max(0, 1 - dt * 6); // 멈추면 자연스럽게 차렷 자세로
      const swing = Math.sin(phase) * 0.55;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      object.position.y = walking ? Math.abs(Math.cos(phase)) * 0.03 : 0;
    },
  };
}
