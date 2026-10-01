// 첫 화면의 HTML 오버레이. 휴대폰에서 VR(전체화면/WebXR)과 소리는 "화면 터치" 같은 사용자 동작이
// 있어야만 시작할 수 있어서, 고글에 끼우기 전에 여기서 한 번 터치하게 한다.
// 이후의 메뉴(시작/모드 선택/결과)는 모두 3D 패널이라 컨트롤러로 조작한다.
export function createStartOverlay({ onFlat, onVr, getGamepadText }) {
  const root = document.createElement("div");
  root.style.cssText = `
    position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 18px; padding: 16px; box-sizing: border-box;
    background: linear-gradient(160deg, rgba(10,22,48,0.96), rgba(20,48,96,0.94));
    color: #fff; text-align: center; font-family: inherit;
  `;
  root.innerHTML = `
    <div style="font-size: clamp(14px, 3.5vw, 18px); color:#9fc3ff; font-weight:600;">교통안전 체험</div>
    <div style="font-size: clamp(26px, 7vw, 44px); font-weight:800;">음주운전 위험성 체험 VR</div>
    <div style="max-width: 560px; font-size: clamp(13px, 3.4vw, 16px); line-height:1.6; opacity:0.85;">
      휴대폰에 블루투스 컨트롤러를 먼저 연결한 뒤 <b>VR 모드로 시작</b>을 누르고,
      휴대폰을 가로로 카드보드 고글에 끼워주세요. 이후 조작은 모두 컨트롤러로 합니다.
    </div>
    <button data-act="vr" style="${btnCss("#ffd54a", "#1b2235")}">VR 모드로 시작 (카드보드)</button>
    <button data-act="flat" style="${btnCss("rgba(255,255,255,0.14)", "#fff")}">화면 모드로 시작</button>
    <div data-pad style="font-size: 14px; opacity: 0.8; min-height: 1.4em;"></div>
    <div style="font-size: 12px; opacity: 0.55;">조작: 왼쪽 스틱 조향 · ZR 가속 · ZL 브레이크 · A 선택 · + 일시정지 · X 정면 재설정</div>
  `;
  document.getElementById("app").appendChild(root);

  const padEl = root.querySelector("[data-pad]");
  const timer = setInterval(() => (padEl.textContent = getGamepadText()), 500);
  padEl.textContent = getGamepadText();

  function close() {
    clearInterval(timer);
    root.remove();
  }
  root.querySelector('[data-act="vr"]').addEventListener("click", () => {
    close();
    onVr();
  });
  root.querySelector('[data-act="flat"]').addEventListener("click", () => {
    close();
    onFlat();
  });

  return {
    get open() {
      return root.isConnected;
    },
    // 키보드 Enter / 컨트롤러 A로 "화면 모드로 시작"
    confirmFlat() {
      if (!root.isConnected) return;
      close();
      onFlat();
    },
  };
}

function btnCss(bg, fg) {
  return `
    min-width: min(320px, 90vw); padding: 14px 22px; border: none; border-radius: 12px;
    background: ${bg}; color: ${fg}; font: inherit; font-size: clamp(16px, 4.5vw, 20px); font-weight: 700;
    cursor: pointer;
  `;
}
