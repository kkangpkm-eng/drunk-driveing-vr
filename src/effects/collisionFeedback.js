import * as THREE from "three";

// 보행자 충돌 피드백: 붉은 화면 점멸 + 경고음. (사실적 묘사 없음)
// 점멸은 DOM 오버레이가 아니라 카메라에 붙인 반투명 판으로 그려서 VR 모드에서도 그대로 보인다.
export function createCollisionFeedback(camera, cfg) {
  const geo = new THREE.PlaneGeometry(4, 4);
  const mat = new THREE.MeshBasicMaterial({
    color: cfg.flashColor,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const quad = new THREE.Mesh(geo, mat);
  quad.position.set(0, 0, -0.25); // 카메라 로컬 -Z = 바라보는 방향
  quad.renderOrder = 999;
  quad.visible = false;
  quad.frustumCulled = false;
  camera.add(quad);

  let t = -1;
  let audioCtx = null;

  // 오디오는 사용자 입력 이후에만 시작할 수 있어서 첫 키 입력 때 미리 준비해 둔다.
  const unlock = () => {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      audioCtx = null;
    }
  };
  window.addEventListener("keydown", unlock);
  window.addEventListener("pointerdown", unlock);

  function beep() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    const freqs = cfg.beepFrequenciesHz;
    const toneLen = 0.15;
    const toneCount = Math.max(1, Math.round(cfg.beepDurationS / toneLen));
    for (let i = 0; i < toneCount; i++) {
      osc.frequency.setValueAtTime(freqs[i % freqs.length], now + i * toneLen);
    }
    gain.gain.setValueAtTime(cfg.beepVolume, now);
    gain.gain.setValueAtTime(cfg.beepVolume, now + cfg.beepDurationS - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + cfg.beepDurationS);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + cfg.beepDurationS + 0.02);
  }

  return {
    trigger() {
      t = 0;
      quad.visible = true;
      beep();
    },
    update(dt) {
      if (t < 0) return;
      t += dt;
      if (t >= cfg.flashDurationS) {
        t = -1;
        quad.visible = false;
        mat.opacity = 0;
        return;
      }
      const p = t / cfg.flashDurationS;
      mat.opacity = cfg.flashMaxOpacity * Math.abs(Math.sin(p * Math.PI * cfg.flashCount)) * (1 - p * 0.5);
    },
    reset() {
      t = -1;
      quad.visible = false;
    },
  };
}
