import { KeyboardInput } from "./keyboardInput.js";
import { GamepadInput } from "./gamepadInput.js";

// 키보드 → 동작 이름 (눌린 순간 1회). 같은 키가 화면 상태에 따라 다른 의미일 수 있어서
// 여러 동작을 함께 내보내고, 어떤 동작을 쓸지는 main.js의 현재 화면 상태가 결정한다.
const KEY_ACTIONS = {
  ArrowUp: ["up"],
  KeyW: ["up"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
  Enter: ["confirm"],
  Space: ["confirm"],
  Escape: ["back", "pause"],
  Backspace: ["back"],
  KeyP: ["pause"],
  KeyR: ["restart"],
  KeyM: ["toggleMode"],
  KeyI: ["debug"],
  KeyT: ["showResults"],
  KeyV: ["toggleVr"],
  KeyC: ["recenter"],
};

// 여러 입력 장치를 하나의 형식({throttle, brake, steer})으로 통합한다.
// 키보드와 게임패드를 동시에 쓸 수 있고, 페달은 큰 값, 조향은 절댓값이 큰 쪽을 택한다.
export class InputManager {
  constructor(config) {
    this.keyboard = new KeyboardInput();
    this.gamepad = new GamepadInput(config.gamepad);
    this._keyQueue = [];
    // 키 입력은 이벤트로 받아 큐에 쌓아 두어, 한 프레임보다 짧은 눌림도 놓치지 않는다.
    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      const acts = KEY_ACTIONS[e.code];
      if (acts) this._keyQueue.push(...acts);
      if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
    });
    this.actions = new Set();
    this.keyActions = new Set(); // 키보드에서 온 동작만
  }

  // 매 프레임 1회 호출. 운전 입력을 돌려주고, 이번 프레임의 동작은 this.actions에 담긴다.
  update(dt) {
    const k = this.keyboard.update(dt);
    const g = this.gamepad.update(dt);
    this.keyActions = new Set(this._keyQueue);
    this.actions = new Set([...this._keyQueue, ...g.actions]);
    this._keyQueue.length = 0;
    return {
      throttle: Math.max(k.throttle, g.throttle),
      brake: Math.max(k.brake, g.brake),
      steer: Math.abs(g.steer) > Math.abs(k.steer) ? g.steer : k.steer,
    };
  }

  has(action) {
    return this.actions.has(action);
  }

  isKeyDown(code) {
    return this.keyboard.isKeyDown(code);
  }

  getStatusText() {
    return this.gamepad.connected ? `게임패드 연결됨 (${this.gamepad.id})` : "키보드 사용";
  }
}
