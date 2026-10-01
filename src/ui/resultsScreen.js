// 일반/음주 모드 주행 기록과 결과 비교 화면.
// 기록은 이벤트가 일어난 순간의 모드에 쌓이고, R(재시작) 시 현재 모드의 기록만 초기화된다.
const MODES = [
  ["normal", "일반 모드"],
  ["drunk", "음주 모드"],
];

const ROWS = [
  ["signalViolations", "신호위반", (v) => `${v}회`],
  ["pedestrianCollisions", "보행자 충돌", (v) => `${v}회`],
  ["laneDepartures", "도로 이탈", (v) => `${v}회`],
  ["finishTimeS", "완주 시간", (v) => (v == null ? "미완주" : `${v.toFixed(1)}초`)],
];

function emptyRecord() {
  return { signalViolations: 0, pedestrianCollisions: 0, laneDepartures: 0, finishTimeS: null, driven: false };
}

export function createRunRecorder() {
  const records = { normal: emptyRecord(), drunk: emptyRecord() };
  return {
    records,
    resetMode(mode) {
      records[mode] = emptyRecord();
    },
    add(mode, key, amount = 1) {
      records[mode][key] += amount;
      records[mode].driven = true;
    },
    finish(mode, timeS) {
      records[mode].finishTimeS = timeS;
      records[mode].driven = true;
    },
  };
}

export function createResultsScreen(recorder) {
  const root = document.createElement("div");
  root.style.cssText = `
    position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.6); color: #fff; z-index: 20; font-family: inherit;
  `;
  const panel = document.createElement("div");
  panel.style.cssText = `
    min-width: 420px; padding: 24px 32px; border-radius: 14px;
    background: rgba(18,28,48,0.95); box-shadow: 0 8px 30px rgba(0,0,0,0.5);
  `;
  root.appendChild(panel);
  document.getElementById("app").appendChild(root);

  function render() {
    const cell = "padding: 8px 14px; border-bottom: 1px solid rgba(255,255,255,0.15);";
    const head = MODES.map(([, label]) => `<th style="${cell} text-align:center">${label}</th>`).join("");
    const body = ROWS.map(([key, label, fmt]) => {
      const tds = MODES.map(([mode]) => {
        const rec = recorder.records[mode];
        const v = rec[key];
        const warn = typeof v === "number" && v > 0 && key !== "finishTimeS";
        const text = rec.driven ? fmt(v) : "-";
        return `<td style="${cell} text-align:center; ${warn ? "color:#ff6b5a; font-weight:700;" : ""}">${text}</td>`;
      }).join("");
      return `<tr><td style="${cell}">${label}</td>${tds}</tr>`;
    }).join("");
    panel.innerHTML = `
      <div style="font-size:24px; font-weight:700; margin-bottom:14px;">주행 결과 비교</div>
      <table style="border-collapse:collapse; width:100%; font-size:18px;">
        <thead><tr><th style="${cell}"></th>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div style="margin-top:14px; font-size:14px; opacity:0.75;">R: 재시작 · M: 모드 전환 · T: 닫기</div>
    `;
  }

  return {
    show() {
      render();
      root.style.display = "flex";
    },
    hide() {
      root.style.display = "none";
    },
    toggle() {
      if (root.style.display === "none") this.show();
      else this.hide();
    },
    get visible() {
      return root.style.display !== "none";
    },
  };
}
