// 주행 중 화면에 표시되는 최소한의 HUD (속도, 모드, 진행률).
export function createHud(totalLengthM) {
  const root = document.createElement("div");
  root.style.cssText = `
    position: absolute; inset: 0; pointer-events: none;
    color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    font-family: inherit; user-select: none;
  `;

  const speedEl = document.createElement("div");
  speedEl.style.cssText = `
    position: absolute; right: 20px; bottom: 20px;
    font-size: 42px; font-weight: 700; text-align: right;
  `;

  const modeEl = document.createElement("div");
  modeEl.style.cssText = `
    position: absolute; left: 20px; top: 16px;
    font-size: 20px; font-weight: 600;
    padding: 6px 14px; border-radius: 8px;
    background: rgba(0,0,0,0.35);
  `;
  modeEl.textContent = "일반 모드";

  const progressWrap = document.createElement("div");
  progressWrap.style.cssText = `
    position: absolute; left: 50%; top: 16px; transform: translateX(-50%);
    width: 200px; height: 8px; border-radius: 4px;
    background: rgba(255,255,255,0.25); overflow: hidden;
  `;
  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    width: 0%; height: 100%; background: #ffd54a;
  `;
  progressWrap.appendChild(progressBar);

  // 신호위반/보행자 충돌 같은 이벤트를 잠깐 띄우는 알림
  const toastEl = document.createElement("div");
  toastEl.style.cssText = `
    position: absolute; left: 50%; top: 22%; transform: translateX(-50%);
    font-size: 34px; font-weight: 800; padding: 10px 26px; border-radius: 10px;
    background: rgba(200,30,30,0.85); opacity: 0; transition: opacity 0.25s;
  `;
  let toastTimer = null;

  root.appendChild(speedEl);
  root.appendChild(modeEl);
  root.appendChild(progressWrap);
  root.appendChild(toastEl);
  document.getElementById("app").appendChild(root);

  return {
    showToast(text, durationMs = 2000) {
      toastEl.textContent = text;
      toastEl.style.opacity = "1";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (toastEl.style.opacity = "0"), durationMs);
    },
    update({ speedKmh, progressZ, modeLabel }) {
      speedEl.textContent = `${Math.round(speedKmh)} km/h`;
      if (modeLabel) modeEl.textContent = modeLabel;
      const pct = Math.max(0, Math.min(100, (progressZ / totalLengthM) * 100));
      progressBar.style.width = `${pct}%`;
    },
  };
}
