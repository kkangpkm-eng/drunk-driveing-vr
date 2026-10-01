import * as THREE from "three";
import { getCrosswalkLayouts } from "./intersectionLayout.js";

// 도로 중심선의 커브 구간 정의: 각 구간은 z(진행거리) 범위와
// 그 구간이 끝날 때의 누적 좌우 오프셋(from -> to)을 갖는다.
// 완만한 커브 3개 + 직선 구간으로 구성 (급커브 없음, VR 멀미 방지).
// 횡단보도(config.crosswalks)는 직선 구간에만 둘 수 있다.
export const CURVE_SEGMENTS = [
  { start: 0, end: 250, from: 0, to: 0 }, // 시작 직선
  { start: 250, end: 500, from: 0, to: 30 }, // 커브 1
  { start: 500, end: 950, from: 30, to: 30 }, // 직선
  { start: 950, end: 1250, from: 30, to: -22 }, // 커브 2
  { start: 1250, end: 1550, from: -22, to: -22 }, // 직선
  { start: 1550, end: 1750, from: -22, to: 8 }, // 커브 3
  { start: 1750, end: 1800, from: 8, to: 8 }, // 도착 직선
];

// z가 직선 구간 안에 있는지 (횡단보도 배치 검증용)
export function isOnStraight(zMin, zMax) {
  return CURVE_SEGMENTS.some((seg) => seg.from === seg.to && zMin >= seg.start && zMax <= seg.end);
}

// 진행거리 z에서 도로 진행 방향(heading, 0 = +Z)을 반환한다.
export function roadHeadingAt(z) {
  const d = 0.5;
  return Math.atan2(roadCenterX(z + d) - roadCenterX(z - d), 2 * d);
}

function smoothstep(t) {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// 진행거리 z에서 도로 중심선의 x좌표를 반환한다.
export function roadCenterX(z) {
  const last = CURVE_SEGMENTS[CURVE_SEGMENTS.length - 1];
  if (z <= 0) return CURVE_SEGMENTS[0].from;
  if (z >= last.end) return last.to;

  for (const seg of CURVE_SEGMENTS) {
    if (z >= seg.start && z <= seg.end) {
      const t = seg.end === seg.start ? 1 : (z - seg.start) / (seg.end - seg.start);
      return seg.from + (seg.to - seg.from) * smoothstep(t);
    }
  }
  return last.to;
}

export function createRoad(config) {
  const group = new THREE.Group();
  const { totalLengthM, halfWidthM, startZ } = config.road;
  const step = 5; // m 단위 샘플링 간격 (커브를 부드럽게 표현)
  const layouts = getCrosswalkLayouts(config);

  // 샘플 z 목록 (교차로 경계 z를 끼워 넣어 차선 끊김 위치가 정확하도록)
  const zs = [];
  for (let z = startZ; z <= totalLengthM; z += step) zs.push(z);
  const edgeGaps = [];
  const dashGaps = [];
  for (const L of layouts) {
    if (L.hasCrossRoad) {
      edgeGaps.push([L.z - L.crossHalf, L.z + L.crossHalf]);
      zs.push(L.z - L.crossHalf, L.z + L.crossHalf);
    }
    dashGaps.push([L.stopLineZ - 1, (L.hasCrossRoad ? L.z + L.crossHalf : L.crosswalkFarZ) + 1]);
  }
  zs.sort((a, b) => a - b);

  // ── 아스팔트 도로 스트립 ────────────────────────────────────
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 1 });
  group.add(new THREE.Mesh(buildStrip(zs, -halfWidthM, halfWidthM, 0, []), roadMat));

  // ── 갓길 라인(도로 양끝 흰색 실선) — 교차 도로 구간에서는 끊는다 ──
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f0 });
  const edgeLineWidth = 0.15;
  group.add(new THREE.Mesh(buildStrip(zs, halfWidthM - edgeLineWidth, halfWidthM, 0.01, edgeGaps), lineMat));
  group.add(new THREE.Mesh(buildStrip(zs, -halfWidthM, -halfWidthM + edgeLineWidth, 0.01, edgeGaps), lineMat));

  // ── 중앙 점선 — 정지선~교차로 구간은 비운다 ─────────────────────
  group.add(createCenterDashes(startZ, totalLengthM, dashGaps, lineMat));

  return group;
}

// 도로 중심선을 따라가는 띠 메시를 만든다. gaps에 포함된 z 구간은 비운다.
function buildStrip(zs, xOffsetMin, xOffsetMax, yLift, gaps) {
  const positions = [];
  const indices = [];
  for (let i = 0; i < zs.length; i++) {
    const z = zs[i];
    const cx = roadCenterX(z);
    positions.push(cx + xOffsetMin, yLift, z);
    positions.push(cx + xOffsetMax, yLift, z);
    if (i > 0) {
      const mid = (zs[i - 1] + z) / 2;
      if (gaps.some(([g0, g1]) => mid > g0 && mid < g1)) continue;
      const a = (i - 1) * 2;
      const b = i * 2;
      indices.push(a, b, a + 1);
      indices.push(a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// 중앙 점선(끊어진 흰색 차선)을 하나의 메시로 생성해 드로우콜을 절약한다.
function createCenterDashes(startZ, totalLengthM, gaps, mat) {
  const dashLength = 3;
  const gapLength = 4;
  const dashWidth = 0.15;
  const positions = [];
  const indices = [];
  let vertIndex = 0;
  let z = startZ + 10;
  while (z < totalLengthM) {
    const zEnd = Math.min(z + dashLength, totalLengthM);
    if (gaps.some(([g0, g1]) => zEnd > g0 && z < g1)) {
      z += dashLength + gapLength;
      continue;
    }
    const zSteps = 3; // 커브에서도 점선이 도로를 따라가도록 짧게 분할
    for (let s = 0; s <= zSteps; s++) {
      const zz = z + ((zEnd - z) * s) / zSteps;
      const cx = roadCenterX(zz);
      positions.push(cx - dashWidth, 0.015, zz);
      positions.push(cx + dashWidth, 0.015, zz);
      if (s > 0) {
        const a = vertIndex - 2;
        const b = vertIndex;
        indices.push(a, b, a + 1);
        indices.push(a + 1, b, b + 1);
      }
      vertIndex += 2;
    }
    z += dashLength + gapLength;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}
