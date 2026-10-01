// 블루투스 게임패드 입력 (Gamepad API, "standard" 배치 기준).
// 스위치 컨트롤러를 안드로이드에 연결하면 대부분 standard 배치로 인식된다.
//  - 왼쪽 스틱 좌우: 조향 (데드존 + 곡선으로 중앙 부근을 섬세하게)
//  - ZR/RT: 가속, ZL/LT: 브레이크 (스위치는 디지털 버튼이므로 서서히 올라가게 보간)
//  - 오른쪽 스틱 상하: 아날로그 가속(위)/브레이크(아래) — 대체 조작
export class GamepadInput {
  constructor(cfg) {
    this.cfg = cfg;
    this._throttle = 0;
    this._brake = 0;
    this._prevButtons = [];
    this._prevStickY = 0;
    this._prevStickX = 0;
    this._analogSeen = { [cfg.throttleButton]: false, [cfg.brakeButton]: false };
    this.connected = false;
    this.id = "";
  }

  _getPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let fallback = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (p.mapping === "standard") return p;
      fallback ??= p;
    }
    return fallback;
  }

  // 반환: { throttle, brake, steer, actions: Set<string> }
  update(dt) {
    const c = this.cfg;
    const pad = this._getPad();
    const actions = new Set();
    this.connected = !!pad;
    if (!pad) {
      this._throttle = this._brake = 0;
      return { throttle: 0, brake: 0, steer: 0, actions };
    }
    this.id = pad.id;

    const btn = (i) => pad.buttons[i] ?? { pressed: false, value: 0 };
    const axis = (i) => (i >= 0 && pad.axes[i] !== undefined ? pad.axes[i] : 0);

    // ── 조향 ──
    const rawSteer = axis(c.steerAxis);
    const mag = Math.max(0, (Math.abs(rawSteer) - c.steerDeadzone) / (1 - c.steerDeadzone));
    const steer = Math.sign(rawSteer) * Math.pow(Math.min(1, mag), c.steerCurve);

    // ── 페달 (트리거 + 오른쪽 스틱) ──
    const trig = (index, current) => {
      const v = btn(index).value ?? (btn(index).pressed ? 1 : 0);
      if (v > 0.05 && v < 0.95) this._analogSeen[index] = true;
      if (this._analogSeen[index]) return v; // 아날로그 트리거는 그대로
      const target = btn(index).pressed ? 1 : 0;
      const rate = target > current ? c.digitalRampUpPerSec : c.digitalRampDownPerSec;
      return approach(current, target, rate * dt);
    };
    this._throttle = trig(c.throttleButton, this._throttle);
    this._brake = trig(c.brakeButton, this._brake);

    let stickThrottle = 0;
    let stickBrake = 0;
    if (c.pedalAxis >= 0) {
      const y = axis(c.pedalAxis);
      const m = Math.max(0, (Math.abs(y) - c.pedalDeadzone) / (1 - c.pedalDeadzone));
      if (y < 0) stickThrottle = m;
      else stickBrake = m;
    }

    // ── 메뉴/기능 버튼 (눌린 순간만) ──
    const pressedNow = pad.buttons.map((b) => b.pressed);
    const edge = (i) => pressedNow[i] && !this._prevButtons[i];
    const any = (list) => list.some(edge);
    if (any(c.confirmButtons)) actions.add("confirm");
    if (any(c.backButtons)) actions.add("back");
    if (any(c.pauseButtons)) actions.add("pause");
    if (any(c.recenterButtons)) actions.add("recenter");
    if (edge(12)) actions.add("up");
    if (edge(13)) actions.add("down");
    if (edge(14)) actions.add("left");
    if (edge(15)) actions.add("right");
    this._prevButtons = pressedNow;

    // 왼쪽 스틱으로도 메뉴 이동 (임계값을 넘는 순간 1회)
    const sx = axis(0);
    const sy = axis(1);
    const th = c.menuStickThreshold;
    if (sy < -th && this._prevStickY >= -th) actions.add("up");
    if (sy > th && this._prevStickY <= th) actions.add("down");
    if (sx < -th && this._prevStickX >= -th) actions.add("left");
    if (sx > th && this._prevStickX <= th) actions.add("right");
    this._prevStickX = sx;
    this._prevStickY = sy;

    return {
      throttle: Math.max(this._throttle, stickThrottle),
      brake: Math.max(this._brake, stickBrake),
      steer,
      actions,
    };
  }
}

function approach(current, target, delta) {
  if (Math.abs(target - current) <= delta) return target;
  return current + Math.sign(target - current) * delta;
}
