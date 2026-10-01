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

  root.appendChild(speedEl);
  root.appendChild(modeEl);
  root.appendChild(progressWrap);
  document.getElementById("app").appendChild(root);

  return {
    setVisible(v) {
      root.style.display = v ? "" : "none";
    },
    update({ speedKmh, progressZ, modeLabel }) {
      speedEl.textContent = `${Math.round(speedKmh)} km/h`;
      if (modeLabel) modeEl.textContent = modeLabel;
      const pct = Math.max(0, Math.min(100, (progressZ / totalLengthM) * 100));
      progressBar.style.width = `${pct}%`;
    },
  };
}
