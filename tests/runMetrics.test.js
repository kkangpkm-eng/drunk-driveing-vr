import { test } from "node:test";
import assert from "node:assert/strict";
import { RunMetrics } from "../src/measurement/runMetrics.js";

const cfg = { brakeReactionThreshold: 0.2, reactionTimeoutS: 5, stoppedSpeedMps: 0.3 };
const frame = (over = {}) => ({ dt: 0.1, rawBrake: 0, speedMps: 10, z: 0, frontZ: 2, offRoad: false, ...over });

test("반응 시간: 위험 시작부터 브레이크 입력까지", () => {
  const m = new RunMetrics(cfg);
  m.update(frame());
  m.startReaction("leadBrake");
  for (let i = 0; i < 7; i++) m.update(frame()); // 0.7초 무반응
  m.update(frame({ rawBrake: 0.5 })); // 0.8초에 반응
  const s = m.summary();
  assert.equal(s.reactionSamples, 1);
  assert.ok(Math.abs(s.leadReactionS - 0.8) < 1e-9);
});

test("임계값 미만의 살짝 밟음은 반응으로 치지 않는다", () => {
  const m = new RunMetrics(cfg);
  m.startReaction("leadBrake");
  m.update(frame({ rawBrake: 0.1 }));
  assert.equal(m.summary().reactionSamples, 0);
});

test("제한 시간 안에 반응이 없으면 반응 실패", () => {
  const m = new RunMetrics(cfg);
  m.startReaction("signal-0");
  for (let i = 0; i < 51; i++) m.update(frame());
  const s = m.summary();
  assert.equal(s.missedReactions, 1);
  assert.equal(s.reactionSamples, 0);
});

test("정지선을 그냥 지나가면 반응 측정 취소 (실패로도 세지 않음)", () => {
  const m = new RunMetrics(cfg);
  m.startReaction("signal-1", 100);
  m.update(frame({ frontZ: 101 }));
  for (let i = 0; i < 60; i++) m.update(frame({ frontZ: 120 }));
  const s = m.summary();
  assert.equal(s.missedReactions, 0);
  assert.equal(s.reactionSamples, 0);
});

test("정지 거리: 급정거 시작 위치부터 멈춘 위치까지", () => {
  const m = new RunMetrics(cfg);
  m.startStoppingDistance(1000);
  m.update(frame({ z: 1010, speedMps: 5 }));
  m.update(frame({ z: 1018.5, speedMps: 0.1 }));
  assert.equal(m.summary().stoppingDistanceM, 18.5);
});

test("정지 중 추돌하면 표시", () => {
  const m = new RunMetrics(cfg);
  m.startStoppingDistance(0);
  m.addRearEndCollision();
  assert.equal(m.summary().collidedDuringStop, true);
});

test("도로 이탈 횟수는 벗어나는 순간마다 1회, 시간은 누적", () => {
  const m = new RunMetrics(cfg);
  m.update(frame({ offRoad: true }));
  m.update(frame({ offRoad: true }));
  m.update(frame());
  m.update(frame({ offRoad: true }));
  const s = m.summary();
  assert.equal(s.laneDepartures, 2);
  assert.ok(Math.abs(s.offRoadTimeS - 0.3) < 1e-9);
});

test("평균 반응 시간은 모든 표본의 평균", () => {
  const m = new RunMetrics(cfg);
  m.startReaction("a");
  m.startReaction("b");
  m.update(frame()); // 0.1
  m.update(frame({ rawBrake: 1 })); // a, b 모두 0.2초
  m.startReaction("c");
  for (let i = 0; i < 5; i++) m.update(frame());
  m.update(frame({ rawBrake: 1 })); // c: 0.6초
  const s = m.summary();
  assert.equal(s.reactionSamples, 3);
  assert.ok(Math.abs(s.avgReactionS - (0.2 + 0.2 + 0.6) / 3) < 1e-9);
});
