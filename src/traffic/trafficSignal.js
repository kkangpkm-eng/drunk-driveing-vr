// 신호 상태 머신 + 신호위반 판정.
// 평소에는 녹색. 차량 앞부분이 정지선에서 triggerDistanceM 안에 들어오면
// 녹색 유지(greenHoldS) → 황색(yellowDurationS) → 적색(redDurationS) → 녹색 순으로 한 번 전환한다.
// 적색 중 차량 앞부분이 정지선을 넘으면(이전 프레임 < stopLineZ ≤ 현재 프레임) 신호위반 1회.
export class TrafficSignalController {
  // layout: getCrosswalkLayouts()의 항목 (layout.cfg.signal에 이 횡단보도의 신호 설정이 들어 있음)
  constructor(layout, setVisualState) {
    this.cfg = layout.cfg.signal;
    this.index = layout.index;
    this.stopLineZ = layout.stopLineZ;
    this.setVisualState = setVisualState;
    this.listeners = { yellow: [], red: [], violation: [] };
    this.reset();
  }

  on(event, fn) {
    this.listeners[event].push(fn);
  }

  reset() {
    this.state = "green";
    this.triggered = false;
    this.phaseTime = 0;
    this.prevFrontZ = null;
    this.violated = false;
    this.setVisualState("green");
  }

  // 개발/스크린샷용: 즉시 적색으로 전환
  forceRed() {
    this.triggered = true;
    this._enter("red");
  }

  _enter(state) {
    this.state = state;
    this.phaseTime = 0;
    this.setVisualState(state);
    if (this.listeners[state]) this.listeners[state].forEach((fn) => fn(this));
  }

  update(dt, carFrontZ) {
    const c = this.cfg;
    const dist = this.stopLineZ - carFrontZ;
    if (!this.triggered && dist >= 0 && dist <= c.triggerDistanceM) {
      this.triggered = true;
      this.phaseTime = 0;
      this.state = "greenHold";
    }

    if (this.triggered) {
      this.phaseTime += dt;
      if (this.state === "greenHold" && this.phaseTime >= c.greenHoldS) this._enter("yellow");
      else if (this.state === "yellow" && this.phaseTime >= c.yellowDurationS) this._enter("red");
      else if (this.state === "red" && this.phaseTime >= c.redDurationS) this._enter("green");
    }

    if (this.prevFrontZ !== null && this.state === "red" && !this.violated) {
      if (this.prevFrontZ < this.stopLineZ && carFrontZ >= this.stopLineZ) {
        this.violated = true;
        this.listeners.violation.forEach((fn) => fn(this));
      }
    }
    this.prevFrontZ = carFrontZ;
  }

  get displayState() {
    return this.state === "greenHold" ? "green" : this.state;
  }
}
