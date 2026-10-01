// 키보드는 0/1 디지털 입력만 들어오므로, 목표값을 향해 서서히 변화시켜
// 아날로그 입력(게임패드 트리거/스틱)과 비슷한 부드러운 반응을 만든다.
const RAMP_UP_PER_SEC = 3.5;
const RAMP_DOWN_PER_SEC = 4.5;
const STEER_RAMP_PER_SEC = 4.0;
const STEER_RELEASE_PER_SEC = 6.0; // 조향키를 떼면 더 빠르게 중앙으로 복귀

export class KeyboardInput {
  constructor() {
    this.keys = new Set();
    this._throttle = 0;
    this._brake = 0;
    this._steer = 0;

    this._onKeyDown = (e) => this.keys.add(e.code);
    this._onKeyUp = (e) => this.keys.delete(e.code);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
  }

  isConnected() {
    return true; // 키보드는 항상 사용 가능
  }

  // dt(초) 기준으로 목표값을 향해 보간한 {throttle, brake, steer} 반환
  update(dt) {
    const wantThrottle = this.keys.has("ArrowUp") || this.keys.has("KeyW");
    const wantBrake = this.keys.has("ArrowDown") || this.keys.has("KeyS");
    const wantLeft = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const wantRight = this.keys.has("ArrowRight") || this.keys.has("KeyD");

    this._throttle = approach(this._throttle, wantThrottle ? 1 : 0, dt, RAMP_UP_PER_SEC, RAMP_DOWN_PER_SEC);
    this._brake = approach(this._brake, wantBrake ? 1 : 0, dt, RAMP_UP_PER_SEC, RAMP_DOWN_PER_SEC);

    const steerTarget = (wantRight ? 1 : 0) - (wantLeft ? 1 : 0);
    const steerRate = steerTarget === 0 ? STEER_RELEASE_PER_SEC : STEER_RAMP_PER_SEC;
    this._steer = approach(this._steer, steerTarget, dt, steerRate, steerRate);

    return { throttle: this._throttle, brake: this._brake, steer: this._steer };
  }

  isKeyDown(code) {
    return this.keys.has(code);
  }
}

function approach(current, target, dt, upRate, downRate) {
  const rate = target > current ? upRate : downRate;
  const delta = rate * dt;
  if (Math.abs(target - current) <= delta) return target;
  return current + Math.sign(target - current) * delta;
}
