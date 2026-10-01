// 주행 1회분 측정. three.js에 의존하지 않는 순수 로직이라 단위 테스트가 가능하다 (tests/).
//
// 반응 시간: 위험 신호(앞차 브레이크등, 신호 황색 전환)가 시작된 순간부터
//           "원래" 브레이크 입력(지연·왜곡 전, 즉 운전자의 실제 반응)이 임계값을 넘을 때까지.
// 정지 거리: 앞차 급정거 시작 순간부터 내 차가 멈출 때까지 이동한 거리 (공주거리 + 제동거리).
export class RunMetrics {
  constructor(measurementCfg) {
    this.cfg = measurementCfg;
    this.reset();
  }

  reset() {
    this.timeS = 0;
    this.distanceM = 0;
    this.maxSpeedKmh = 0;
    this.signalViolations = 0;
    this.pedestrianCollisions = 0;
    this.rearEndCollisions = 0;
    this.laneDepartures = 0;
    this.offRoadTimeS = 0;
    this.finished = false;
    this.finishTimeS = null;
    this.reactions = []; // { kind, seconds }
    this.missedReactions = 0;
    this.pendingReactions = []; // { kind, startT, cancelZ }
    this.stopping = null; // 진행 중인 정지 거리 측정 { startZ }
    this.stoppingDistanceM = null;
    this.collidedDuringStop = false;
    this._wasOffRoad = false;
  }

  // kind: "leadBrake" | "signal". cancelAtZ: 차 앞부분이 이 z를 넘으면 측정 취소 (예: 정지선 통과)
  startReaction(kind, cancelAtZ = Infinity) {
    if (this.pendingReactions.some((r) => r.kind === kind)) return;
    this.pendingReactions.push({ kind, startT: this.timeS, cancelAtZ });
  }

  startStoppingDistance(playerZ) {
    this.stopping = { startZ: playerZ };
    this.stoppingDistanceM = null;
    this.collidedDuringStop = false;
  }

  addSignalViolation() {
    this.signalViolations++;
  }

  addPedestrianCollision(n = 1) {
    this.pedestrianCollisions += n;
  }

  addRearEndCollision() {
    this.rearEndCollisions++;
    if (this.stopping) this.collidedDuringStop = true;
  }

  // 매 프레임 호출. s: { dt, rawBrake, speedMps, z, frontZ, offRoad }
  update(s) {
    this.timeS += s.dt;
    this.distanceM += s.speedMps * s.dt;
    this.maxSpeedKmh = Math.max(this.maxSpeedKmh, s.speedMps * 3.6);

    if (s.offRoad) {
      this.offRoadTimeS += s.dt;
      if (!this._wasOffRoad) this.laneDepartures++;
    }
    this._wasOffRoad = s.offRoad;

    // 반응 시간
    const still = [];
    for (const r of this.pendingReactions) {
      const elapsed = this.timeS - r.startT;
      if (s.rawBrake >= this.cfg.brakeReactionThreshold) {
        this.reactions.push({ kind: r.kind, seconds: elapsed });
      } else if (s.frontZ >= r.cancelAtZ) {
        // 브레이크 없이 정지선을 지나감 → 반응 표본에서 제외 (신호위반 여부는 따로 기록됨)
      } else if (elapsed >= this.cfg.reactionTimeoutS) {
        this.missedReactions++;
      } else {
        still.push(r);
      }
    }
    this.pendingReactions = still;

    // 정지 거리
    if (this.stopping && s.speedMps < this.cfg.stoppedSpeedMps) {
      this.stoppingDistanceM = s.z - this.stopping.startZ;
      this.stopping = null;
    }
  }

  finish() {
    this.finished = true;
    this.finishTimeS = this.timeS;
  }

  summary() {
    const rs = this.reactions.map((r) => r.seconds);
    const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
    const lead = this.reactions.find((r) => r.kind === "leadBrake");
    return {
      finished: this.finished,
      finishTimeS: this.finishTimeS,
      avgSpeedKmh: this.timeS > 0 ? (this.distanceM / this.timeS) * 3.6 : 0,
      maxSpeedKmh: this.maxSpeedKmh,
      avgReactionS: avg,
      reactionSamples: rs.length,
      missedReactions: this.missedReactions,
      leadReactionS: lead ? lead.seconds : null,
      stoppingDistanceM: this.stoppingDistanceM,
      collidedDuringStop: this.collidedDuringStop,
      signalViolations: this.signalViolations,
      pedestrianCollisions: this.pedestrianCollisions,
      rearEndCollisions: this.rearEndCollisions,
      laneDepartures: this.laneDepartures,
      offRoadTimeS: this.offRoadTimeS,
    };
  }
}
