import { KeyboardInput } from "./keyboardInput.js";

// 여러 입력 장치를 하나의 형식({throttle, brake, steer})으로 통합한다.
// 4단계에서 게임패드가 추가되면 이 클래스 안에서 우선순위/병합 로직만 확장하면 된다.
export class InputManager {
  constructor() {
    this.keyboard = new KeyboardInput();
  }

  update(dt) {
    return this.keyboard.update(dt);
  }

  isKeyDown(code) {
    return this.keyboard.isKeyDown(code);
  }

  getStatusText() {
    return "키보드 사용";
  }
}
