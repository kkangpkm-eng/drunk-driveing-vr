// 개발용 입력 디버그 오버레이: 원래 입력값과 지연 적용 후 값을 막대그래프로 동시 표시.
// I 키로 토글한다 (src/main.js 참고).
const CHANNELS = [
  { key: "throttle", label: "가속", signed: false },
  { key: "brake", label: "브레이크", signed: false },
  { key: "steer", label: "조향", signed: true },
];

export function createInputDebugOverlay() {
  const root = document.createElement("div");
  root.style.cssText = `
    position: absolute; left: 20px; bottom: 100px; width: 260px;
    background: rgba(0,0,0,0.55); border-radius: 8px; padding: 10px 12px;
    color: #fff; font-size: 12px; pointer-events: none;
  `;
  root.hidden = true;

  const title = document.createElement("div");
  title.textContent = "입력 디버그 (I 키로 토글) — 밝은색: 원래 입력 / 어두운색: 지연 적용 후";
  title.style.cssText = "margin-bottom: 6px; opacity: 0.85; font-size: 11px;";
  root.appendChild(title);

  const rows = {};
  for (const ch of CHANNELS) {
    const row = document.createElement("div");
    row.style.cssText = "margin: 6px 0;";

    const label = document.createElement("div");
    label.textContent = ch.label;
    label.style.cssText = "margin-bottom: 2px;";
    row.appendChild(label);

    const track = document.createElement("div");
    track.style.cssText = `
      position: relative; height: 14px; background: rgba(255,255,255,0.15);
      border-radius: 4px; overflow: hidden;
    `;

    const rawBar = document.createElement("div");
    rawBar.style.cssText = `
      position: absolute; top: 0; bottom: 0; background: #ffd54a; opacity: 0.9;
    `;
    const delayedBar = document.createElement("div");
    delayedBar.style.cssText = `
      position: absolute; top: 0; bottom: 0; background: #4a90e2; opacity: 0.75;
    `;

    track.appendChild(rawBar);
    track.appendChild(delayedBar);
    row.appendChild(track);
    root.appendChild(row);

    rows[ch.key] = { rawBar, delayedBar, signed: ch.signed };
  }

  document.getElementById("app").appendChild(root);

  function barStyle(el, value, signed) {
    // signed(-1~1): 중앙(50%)을 기준으로 좌우로 표시. unsigned(0~1): 왼쪽부터 채움.
    if (signed) {
      const half = Math.max(-1, Math.min(1, value)) * 50;
      if (half >= 0) {
        el.style.left = "50%";
        el.style.width = `${half}%`;
      } else {
        el.style.left = `${50 + half}%`;
        el.style.width = `${-half}%`;
      }
    } else {
      const pct = Math.max(0, Math.min(1, value)) * 100;
      el.style.left = "0%";
      el.style.width = `${pct}%`;
    }
  }

  return {
    setVisible(visible) {
      root.hidden = !visible;
    },
    update(rawInput, delayedInput) {
      if (root.hidden) return;
      for (const ch of CHANNELS) {
        const r = rows[ch.key];
        barStyle(r.rawBar, rawInput[ch.key], r.signed);
        barStyle(r.delayedBar, delayedInput[ch.key], r.signed);
      }
    },
  };
}
