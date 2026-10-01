import { roadCenterX } from "../scene/road.js";
import { isOnStationGrounds } from "../scene/policeStation.js";

const KMH_PER_MPS = 3.6;

// 간단한 아케이드식 차량 물리.
// 좌표계: 차량 전방 = 월드 +Z, heading(요각) 0 = +Z 방향, 양수 방향 = 시계방향(오른쪽).
export class VehiclePhysics {
  constructor(config) {
    this.config = config;
    this.reset();
  }

  reset() {
    // 경찰서 주차장에서 정문을 바라보고 출발한다 (config.course)
    const { course } = this.config;
    this.x = course.startX;
    this.z = course.startZ;
    this.heading = course.startHeadingRad;
    this.speedMps = 0;
    this.offRoad = false;
    this.laneDepartureCount = 0;
    this.laneDepartureTimeS = 0;
    this._wasOffRoad = false;
  }

  // input: { throttle, brake, steer } 모두 -1~1 또는 0~1 범위로 정규화된 값
  update(input, dt) {
    const { vehicle, road } = this.config;
    const maxSpeedMps = vehicle.maxSpeedKmh / KMH_PER_MPS;

    // ── 종방향(가속/제동) ──────────────────────────────────
    let accel = input.throttle * vehicle.accelerationMps2;
    accel -= input.brake * vehicle.brakeDecelerationMps2;
    if (input.throttle <= 0.01 && input.brake <= 0.01) {
      // 입력이 없으면 자연스럽게 서서히 감속 (엔진 브레이크/공기 저항)
      accel -= Math.sign(this.speedMps) * vehicle.naturalDragMps2;
    }

    const offRoadDrag = this.offRoad ? road.offRoadDragMultiplier : 1;
    this.speedMps += accel * dt;
    if (this.offRoad) {
      this.speedMps -= vehicle.naturalDragMps2 * (offRoadDrag - 1) * dt * Math.sign(this.speedMps || 1);
    }
    this.speedMps = Math.max(0, Math.min(maxSpeedMps, this.speedMps));

    // ── 조향 ────────────────────────────────────────────
    const speedFrac = Math.min(1, this.speedMps / maxSpeedMps);
    const sensitivity =
      1 - vehicle.steeringSpeedSensitivity * speedFrac * (1 - vehicle.minSteeringSensitivityFactor);
    // 카메라를 180도 돌려 전방을 +Z로 삼았기 때문에(sceneSetup.js), 화면상
    // "오른쪽"은 월드 -X 방향에 해당한다. 그래서 조향 입력의 부호를 반대로 적용해야
    // 오른쪽 입력이 실제로 화면 오른쪽으로 굽어간다.
    const yawRate = -input.steer * vehicle.maxYawRateRadPerSec * sensitivity;
    this.heading += yawRate * dt;

    // ── 위치 갱신 (전방 = +Z) ─────────────────────────────
    this.x += Math.sin(this.heading) * this.speedMps * dt;
    this.z += Math.cos(this.heading) * this.speedMps * dt;

    // ── 도로 이탈 판정 ─────────────────────────────────────
    const centerX = roadCenterX(this.z);
    const lateralOffset = this.x - centerX;
    // 경찰서 부지(주차장)는 포장 구역이므로 도로 이탈로 보지 않는다.
    this.offRoad = Math.abs(lateralOffset) > road.halfWidthM && !isOnStationGrounds(this.x, this.z, this.config);

    if (this.offRoad) {
      this.laneDepartureTimeS += dt;
      if (!this._wasOffRoad) this.laneDepartureCount += 1;
    }
    this._wasOffRoad = this.offRoad;

    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      speedMps: this.speedMps,
      speedKmh: this.speedMps * KMH_PER_MPS,
      offRoad: this.offRoad,
    };
  }
}
