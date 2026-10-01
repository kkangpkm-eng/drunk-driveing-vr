// 입력값을 타임스탬프와 함께 쌓아두고, 채널별로 지정된 시간만큼
// 과거 값을 보간해서 돌려준다. 음주 모드의 "입력이 늦게 반영되는" 효과의 핵심.
export class InputDelayBuffer {
  constructor(maxAgeMs = 1000) {
    this.maxAgeMs = maxAgeMs;
    this.samples = []; // { t, throttle, brake, steer } (t 오름차순)
  }

  reset() {
    this.samples.length = 0;
  }

  push(tMs, input) {
    this.samples.push({ t: tMs, throttle: input.throttle, brake: input.brake, steer: input.steer });
    const cutoff = tMs - this.maxAgeMs;
    // 보간에 필요한 마지막 한 점은 항상 남겨둔다.
    while (this.samples.length > 2 && this.samples[1].t < cutoff) {
      this.samples.shift();
    }
  }

  // channel: "throttle" | "brake" | "steer"
  getDelayed(channel, delayMs, nowMs) {
    const targetT = nowMs - delayMs;
    const s = this.samples;
    if (s.length === 0) return 0;
    if (targetT <= s[0].t) return s[0][channel];

    for (let i = 1; i < s.length; i++) {
      if (targetT <= s[i].t) {
        const a = s[i - 1];
        const b = s[i];
        const span = b.t - a.t;
        const frac = span <= 0 ? 0 : (targetT - a.t) / span;
        return a[channel] + (b[channel] - a[channel]) * frac;
      }
    }
    return s[s.length - 1][channel];
  }
}
