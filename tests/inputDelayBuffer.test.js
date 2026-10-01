import { test } from "node:test";
import assert from "node:assert/strict";
import { InputDelayBuffer } from "../src/input/inputDelayBuffer.js";

const input = (v) => ({ throttle: v, brake: v, steer: v });

test("지연 0이면 최신 값을 돌려준다", () => {
  const b = new InputDelayBuffer();
  b.push(0, input(0));
  b.push(100, input(1));
  assert.equal(b.getDelayed("steer", 0, 100), 1);
});

test("지연 시간만큼 과거 값을 선형 보간한다", () => {
  const b = new InputDelayBuffer();
  b.push(0, input(0));
  b.push(100, input(1));
  b.push(200, input(1));
  // now=200, delay=150 → t=50 → 0과 1의 중간
  assert.equal(b.getDelayed("throttle", 150, 200), 0.5);
});

test("가장 오래된 샘플보다 더 과거를 요청하면 첫 샘플 값", () => {
  const b = new InputDelayBuffer();
  b.push(500, input(0.3));
  b.push(600, input(0.8));
  assert.equal(b.getDelayed("brake", 1000, 600), 0.3);
});

test("maxAge보다 오래된 샘플은 버리되 보간용 한 점은 남긴다", () => {
  const b = new InputDelayBuffer(100);
  for (let t = 0; t <= 1000; t += 10) b.push(t, input(t / 1000));
  assert.ok(b.samples.length <= 13);
  assert.ok(Math.abs(b.getDelayed("steer", 50, 1000) - 0.95) < 1e-9);
});
