// 음주 모드에서 "지연된" 조향 입력을 다시 한 번 왜곡시켜
// 감도 저하 / 저주파 노이즈 / 과조향(오버슈트) / 반응 둔화를 표현한다.
// 물리(vehiclePhysics)에는 여기서 나온 값이 최종 유효 조향값으로 전달된다.
export class DrunkSteeringProcessor {
  constructor() {
    this.smoothed = 0; // lerp(반응 둔화) 결과 — 실제로 차량/핸들에 쓰이는 값
    this.laggedRef = 0; // 최근 평균 추세 (과조향 감지용)
    this.overshootSign = 0;
    this.overshootTimer = 0;
    this.cooldown = 0;
  }

  reset() {
    this.smoothed = 0;
    this.laggedRef = 0;
    this.overshootSign = 0;
    this.overshootTimer = 0;
    this.cooldown = 0;
  }

  // delayedSteer: 지연 버퍼를 거친 조향값(-1~1). intensity: 0~1(정상 모드는 항상 0으로 호출)
  process(delayedSteer, dt, elapsedS, steeringCfg, intensity) {
    if (intensity <= 0) {
      // 정상 모드: 왜곡 없이 그대로 통과시키되, 내부 상태도 최신값으로 맞춰둔다
      // (모드를 음주로 전환했을 때 갑자기 과거 값에서 튀지 않도록).
      this.smoothed = delayedSteer;
      this.laggedRef = delayedSteer;
      this.overshootTimer = 0;
      this.cooldown = 0;
      return delayedSteer;
    }

    // 1) 조향 감도 저하
    const sensitivity = 1 - intensity * (1 - steeringCfg.sensitivityFactor);
    let target = delayedSteer * sensitivity;

    // 2) 과조향(오버슈트): 최근 추세 대비 급격히 바뀌면 잠깐 더 돌아갔다가 되돌아온다
    const refAlpha = 1 - Math.exp(-dt / steeringCfg.oversteerRefTauS);
    this.laggedRef += (target - this.laggedRef) * refAlpha;
    const delta = target - this.laggedRef;

    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.cooldown <= 0 && Math.abs(delta) > steeringCfg.oversteerTriggerDelta) {
      this.overshootSign = Math.sign(delta);
      this.overshootTimer = steeringCfg.oversteerDurationS;
      this.cooldown = steeringCfg.oversteerDurationS + 0.2;
    }
    if (this.overshootTimer > 0) {
      const remainFrac = this.overshootTimer / steeringCfg.oversteerDurationS;
      target += this.overshootSign * steeringCfg.oversteerAmount * intensity * remainFrac;
      this.overshootTimer = Math.max(0, this.overshootTimer - dt);
    }

    // 3) 저주파 노이즈 (사인파 두 개 합성 — 완전한 주기성을 피함)
    const noise =
      (Math.sin(elapsedS * steeringCfg.noiseFreq1RadPerSec) * 0.6 +
        Math.sin(elapsedS * steeringCfg.noiseFreq2RadPerSec + 1.7) * 0.4) *
      steeringCfg.noiseAmplitude *
      intensity;
    target += noise;

    // 4) 반응 둔화: 목표값을 천천히 따라가도록 지수 보간 (frame rate 독립적)
    const tau = intensity * steeringCfg.reactionTimeConstantS;
    const alpha = tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);
    this.smoothed += (target - this.smoothed) * alpha;

    return this.smoothed;
  }
}

// 브레이크는 지연 외에 추가로 약하게만 반영된다.
export function applyBrakeWeakening(delayedBrake, brakeCfg, intensity) {
  const effectiveness = 1 - intensity * (1 - brakeCfg.effectivenessFactor);
  return delayedBrake * effectiveness;
}
