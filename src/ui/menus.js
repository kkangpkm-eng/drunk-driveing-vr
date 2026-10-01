import { createPanel3D, roundRect, font } from "./panel3d.js";

// 게임 흐름 화면(시작 → 모드 선택 → 결과 비교, 일시정지)과 주행 중 알림을 3D 패널로 그린다.
// 패널은 차량 그룹(운전석) 기준으로 눈앞에 고정되어, 화면/VR 어느 모드에서나 같은 위치에 보인다.

const BG = "rgba(14, 24, 44, 0.93)";
const ACCENT = "#ffd54a";
const DANGER = "#ff6b5a";
const MODE_LABEL = { normal: "일반 모드", drunk: "음주 모드" };

export function createMenus(carGroup, config) {
  const ui = config.ui;
  const eyeY = config.cockpit.eyeHeightM;
  const menuW = ui.menuWidthM;
  const menuH = menuW * 0.72;

  // 차량 그룹 좌표: 전방 = +Z. 평면 기본 방향(+Z를 바라봄)을 뒤집어 운전자 쪽을 향하게 한다.
  const menu = createPanel3D(menuW, menuH);
  menu.mesh.position.set(0, eyeY + 0.05, ui.menuDistanceM);
  menu.mesh.rotation.y = Math.PI;
  carGroup.add(menu.mesh);

  const toast = createPanel3D(1.3, 0.24, 500);
  toast.mesh.position.set(0, eyeY + ui.toastHeightOffsetM, ui.toastDistanceM);
  toast.mesh.rotation.y = Math.PI;
  toast.mesh.renderOrder = 950;
  carGroup.add(toast.mesh);
  let toastTimer = 0;

  // ── 공통 그리기 ──
  function frame(ctx, w, h) {
    ctx.fillStyle = BG;
    roundRect(ctx, 4, 4, w - 8, h - 8, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawOptions(ctx, w, y0, options, selected, rowH = 74) {
    const bw = w * 0.62;
    options.forEach((label, i) => {
      const y = y0 + i * (rowH + 14);
      const x = (w - bw) / 2;
      const on = i === selected;
      ctx.fillStyle = on ? ACCENT : "rgba(255,255,255,0.1)";
      roundRect(ctx, x, y, bw, rowH, 16);
      ctx.fill();
      ctx.fillStyle = on ? "#1b2235" : "#ffffff";
      ctx.font = font(rowH * 0.42, 700);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(on ? `▶  ${label}` : label, w / 2, y + rowH / 2 + 2);
    });
  }

  function footer(ctx, w, h, text) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = font(26, 500);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(text, w / 2, h - 30);
  }

  const CONTROLS_HINT = "선택: 방향키/스틱 · 확인: A (Enter) · 뒤로: − (Esc)";

  // ── 화면별 ──
  function showTitle(gamepadText) {
    menu.draw((ctx, w, h) => {
      frame(ctx, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#9fc3ff";
      ctx.font = font(32, 600);
      ctx.fillText("교통안전 체험", w / 2, 92);
      ctx.fillStyle = "#ffffff";
      ctx.font = font(72, 800);
      ctx.fillText("음주운전 위험성 체험", w / 2, 180);
      ctx.font = font(30, 500);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("같은 코스를 일반 모드와 음주 모드로 주행하고", w / 2, 260);
      ctx.fillText("반응 시간·정지 거리·위반 기록을 비교합니다.", w / 2, 302);
      drawOptions(ctx, w, 370, ["시작하기"], 0, 84);
      ctx.fillStyle = gamepadText.startsWith("게임패드") ? "#8ef0a8" : "rgba(255,255,255,0.6)";
      ctx.font = font(26, 500);
      ctx.fillText(gamepadText, w / 2, 520);
      footer(ctx, w, h, "확인: A 버튼 (키보드 Enter)");
    });
    menu.setVisible(true);
  }

  function showModeSelect(selected, results) {
    menu.draw((ctx, w, h) => {
      frame(ctx, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = font(56, 800);
      ctx.fillText("주행 모드 선택", w / 2, 110);
      ctx.font = font(28, 500);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText("두 모드를 모두 주행하면 결과를 비교할 수 있습니다.", w / 2, 165);
      const labels = ["normal", "drunk"].map((m) => `${MODE_LABEL[m]}${results[m] ? "  ✓ 완료" : ""}`);
      drawOptions(ctx, w, 220, labels, selected, 88);
      ctx.font = font(26, 500);
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      const desc =
        selected === 0
          ? "평소 상태로 운전합니다."
          : "반응 지연·조향 부정확·시야 흐림·터널 시야가 적용됩니다.";
      ctx.fillText(desc, w / 2, 450);
      footer(ctx, w, h, CONTROLS_HINT);
    });
    menu.setVisible(true);
  }

  function showPause(selected, options) {
    menu.draw((ctx, w, h) => {
      frame(ctx, w, h);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = font(56, 800);
      ctx.fillText("일시정지", w / 2, 110);
      drawOptions(ctx, w, 170, options, selected, 80);
      footer(ctx, w, h, CONTROLS_HINT);
    });
    menu.setVisible(true);
  }

  // results: { normal: summary|null, drunk: summary|null }
  function showResults(results, selected, options) {
    menu.draw((ctx, w, h) => {
      frame(ctx, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      ctx.font = font(46, 800);
      ctx.fillText("주행 결과 비교", w / 2, 70);

      const rows = resultRows(results);
      const colX = [w * 0.07, w * 0.56, w * 0.82];
      const top = 112;
      const rowH = 43;
      ctx.font = font(28, 700);
      ctx.fillStyle = "#9fc3ff";
      ctx.textAlign = "center";
      ctx.fillText(MODE_LABEL.normal, colX[1], top);
      ctx.fillText(MODE_LABEL.drunk, colX[2], top);
      rows.forEach((r, i) => {
        const y = top + 14 + (i + 1) * rowH;
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(colX[0] - 12, y - rowH + 9, w * 0.88, rowH);
        }
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = font(27, 500);
        ctx.fillText(r.label, colX[0], y);
        ctx.textAlign = "center";
        r.values.forEach((v, j) => {
          ctx.fillStyle = v.warn ? DANGER : "#fff";
          ctx.font = font(27, v.warn ? 800 : 600);
          ctx.fillText(v.text, colX[j + 1], y);
        });
      });

      const msg = comparisonMessage(results);
      const msgY = top + 14 + (rows.length + 1) * rowH + 12;
      if (msg) {
        ctx.fillStyle = ACCENT;
        ctx.font = font(27, 700);
        ctx.textAlign = "center";
        ctx.fillText(msg, w / 2, msgY);
      }

      // 버튼은 가로로 나열
      const bw = (w * 0.86) / options.length - 14;
      options.forEach((label, i) => {
        const x = w * 0.07 + i * (bw + 14);
        const y = h - 140;
        const on = i === selected;
        ctx.fillStyle = on ? ACCENT : "rgba(255,255,255,0.1)";
        roundRect(ctx, x, y, bw, 62, 14);
        ctx.fill();
        ctx.fillStyle = on ? "#1b2235" : "#fff";
        ctx.font = font(26, 700);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + bw / 2, y + 33);
        ctx.textBaseline = "alphabetic";
      });
      footer(ctx, w, h, "선택: 좌우 방향키/스틱 · 확인: A (Enter)");
    });
    menu.setVisible(true);
  }

  function hide() {
    menu.setVisible(false);
  }

  function showToast(text, color = "rgba(200,30,30,0.92)") {
    toast.draw((ctx, w, h) => {
      ctx.fillStyle = color;
      roundRect(ctx, 4, 4, w - 8, h - 8, 22);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = font(h * 0.46, 800);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2 + 3);
    });
    toast.setVisible(true);
    toast.setOpacity(1);
    toastTimer = ui.toastDurationS;
  }

  function update(dt) {
    if (toastTimer <= 0) return;
    toastTimer -= dt;
    toast.setOpacity(Math.min(1, toastTimer / 0.3));
    if (toastTimer <= 0) toast.setVisible(false);
  }

  function hideToast() {
    toastTimer = 0;
    toast.setVisible(false);
  }

  return { showTitle, showModeSelect, showPause, showResults, hide, showToast, hideToast, update };
}

// ── 결과 표 ──────────────────────────────────────────────────

const sec = (v) => (v == null ? "-" : `${v.toFixed(2)}초`);
const cnt = (v) => `${v}회`;

function resultRows(results) {
  const defs = [
    ["완주 시간", (s) => ({ text: s.finishTimeS == null ? "미완주" : `${s.finishTimeS.toFixed(1)}초` })],
    ["평균 속도", (s) => ({ text: `${s.avgSpeedKmh.toFixed(0)} km/h` })],
    ["평균 반응 시간", (s) => ({ text: s.avgReactionS == null ? "-" : `${sec(s.avgReactionS)} (${s.reactionSamples}회)`, warn: s.avgReactionS > 1.2 })],
    ["반응 실패 (5초 내 무반응)", (s) => ({ text: cnt(s.missedReactions), warn: s.missedReactions > 0 })],
    ["앞차 급정거 반응 시간", (s) => ({ text: sec(s.leadReactionS), warn: s.leadReactionS > 1.2 })],
    [
      "앞차 급정거 정지 거리",
      (s) => ({
        text: s.collidedDuringStop ? "추돌" : s.stoppingDistanceM == null ? "-" : `${s.stoppingDistanceM.toFixed(1)} m`,
        warn: s.collidedDuringStop,
      }),
    ],
    ["앞차 추돌", (s) => ({ text: cnt(s.rearEndCollisions), warn: s.rearEndCollisions > 0 })],
    ["신호위반", (s) => ({ text: cnt(s.signalViolations), warn: s.signalViolations > 0 })],
    ["보행자 충돌", (s) => ({ text: cnt(s.pedestrianCollisions), warn: s.pedestrianCollisions > 0 })],
    ["도로 이탈", (s) => ({ text: `${s.laneDepartures}회 / ${s.offRoadTimeS.toFixed(1)}초`, warn: s.laneDepartures > 0 })],
  ];
  return defs.map(([label, fn]) => ({
    label,
    values: ["normal", "drunk"].map((m) => (results[m] ? fn(results[m]) : { text: "주행 전" })),
  }));
}

function comparisonMessage(results) {
  const n = results.normal;
  const d = results.drunk;
  if (!n || !d) return "다른 모드도 주행하면 결과를 비교할 수 있습니다.";
  if (n.avgReactionS != null && d.avgReactionS != null && d.avgReactionS > n.avgReactionS) {
    return `음주 모드에서 반응이 평균 ${(d.avgReactionS - n.avgReactionS).toFixed(2)}초 늦었습니다. 음주운전은 절대 안 됩니다.`;
  }
  const nBad = n.signalViolations + n.pedestrianCollisions + n.rearEndCollisions;
  const dBad = d.signalViolations + d.pedestrianCollisions + d.rearEndCollisions;
  if (dBad > nBad) return `음주 모드에서 위반·사고가 ${dBad - nBad}건 더 많았습니다. 음주운전은 절대 안 됩니다.`;
  return "술을 마시면 판단력과 반응 속도가 떨어집니다. 음주운전은 절대 안 됩니다.";
}
