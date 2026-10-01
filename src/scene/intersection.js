import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getCrosswalkLayouts } from "./intersectionLayout.js";
import { SIDEWALK_PAD_HEIGHT_M } from "../traffic/pedestrians.js";

// 코스 전체의 신호등 횡단보도(config.crosswalks)를 만든다.
// - 교차 도로 / 보도 블록: 전체를 하나로 병합
// - 횡단보도 줄무늬 / 정지선 / 신호등 기둥·하우징: 전체를 InstancedMesh로
// - 신호등 램프: 횡단보도마다 신호 상태가 다르므로 횡단보도별 재질(적·황·녹)을 쓰고
//   점등은 emissive 밝기만 바꾼다 (PointLight는 옵션, 기본 끔).
export function createCrosswalks(config) {
  const { halfWidthM } = config.road;
  const layouts = getCrosswalkLayouts(config);
  const group = new THREE.Group();

  group.add(createCrossRoads(layouts));
  group.add(createStripes(layouts, halfWidthM));
  group.add(createStopLines(layouts, halfWidthM));
  group.add(createSidewalkPads(layouts, halfWidthM));

  const signalGeo = buildSignalGeometry(config.crosswalkDefaults.signal);
  group.add(createSignalPoles(layouts, halfWidthM, signalGeo));

  const items = layouts.map((L) => {
    const lamps = createSignalLamps(L, halfWidthM, signalGeo);
    group.add(lamps.group);
    return { layout: L, setSignalState: lamps.setState };
  });

  return { group, items };
}

// ── 바닥 요소 ────────────────────────────────────────────────

// 교차 도로 (본 도로보다 살짝 아래 → 겹치는 부분은 본 도로가 덮음)
function createCrossRoads(layouts) {
  const geos = layouts
    .filter((L) => L.hasCrossRoad)
    .map((L) => {
      const g = new THREE.PlaneGeometry(L.cfg.crossRoadLengthM, L.crossHalf * 2);
      g.rotateX(-Math.PI / 2);
      g.translate(L.cx, -0.006, L.z);
      return g;
    });
  if (geos.length === 0) return new THREE.Group();
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 1 }));
}

const WHITE_MAT = new THREE.MeshBasicMaterial({ color: 0xf2f2f0 });

// 횡단보도 줄무늬 (모든 횡단보도를 InstancedMesh 1개로, 도로면 + heightAboveRoadM)
function createStripes(layouts, halfWidthM) {
  const stripeGeo = new THREE.PlaneGeometry(1, 1);
  stripeGeo.rotateX(-Math.PI / 2);
  const placements = [];
  for (const L of layouts) {
    const cw = L.cfg.crosswalk;
    const pitch = cw.stripeWidthM + cw.stripeGapM;
    const count = Math.floor((halfWidthM * 2 - cw.stripeGapM) / pitch);
    const usedWidth = count * pitch - cw.stripeGapM;
    const firstX = L.cx - usedWidth / 2 + cw.stripeWidthM / 2;
    const cz = (L.crosswalkNearZ + L.crosswalkFarZ) / 2;
    for (let i = 0; i < count; i++) {
      placements.push([firstX + i * pitch, cw.heightAboveRoadM, cz, cw.stripeWidthM, cw.lengthM]);
    }
  }
  const mesh = new THREE.InstancedMesh(stripeGeo, WHITE_MAT, placements.length);
  const dummy = new THREE.Object3D();
  placements.forEach(([x, y, z, w, l], i) => {
    dummy.position.set(x, y, z);
    dummy.scale.set(w, 1, l);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

// 정지선 (진행 차로 = 운전자 오른쪽 차로만, 중앙선~도로 오른쪽 끝).
// 정지선 판정 z(L.stopLineZ)가 정지선의 "앞쪽 끝"이 되도록 배치.
function createStopLines(layouts, halfWidthM) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, WHITE_MAT, layouts.length);
  const dummy = new THREE.Object3D();
  layouts.forEach((L, i) => {
    const w = L.cfg.stopLine.widthM;
    dummy.position.set(L.cx - halfWidthM / 2, L.cfg.crosswalk.heightAboveRoadM, L.stopLineZ - w / 2);
    dummy.scale.set(halfWidthM, 1, w);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

// 보도 블록 (횡단보도 양 끝, 보행자 대기 위치)
function createSidewalkPads(layouts, halfWidthM) {
  const geos = [];
  for (const L of layouts) {
    const pad = L.cfg.sidewalkPadM;
    const cz = (L.crosswalkNearZ + L.crosswalkFarZ) / 2;
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(pad, SIDEWALK_PAD_HEIGHT_M, L.cfg.crosswalk.lengthM + 2);
      g.translate(L.cx + side * (halfWidthM + pad / 2), SIDEWALK_PAD_HEIGHT_M / 2, cz);
      geos.push(g);
    }
  }
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ color: 0xb8b3a8, roughness: 1 }));
}

// ── 신호등 ───────────────────────────────────────────────────

// 신호등 기둥 위치: 교차로면 교차 도로 건너편 오른쪽 모서리, 단독 횡단보도면 횡단보도 바로 건너편 오른쪽.
function signalPolePosition(L, halfWidthM) {
  const z = L.hasCrossRoad ? L.z + L.crossHalf + 1.2 : L.crosswalkFarZ + 1.5;
  return new THREE.Vector3(L.cx - halfWidthM - 1.2, 0, z);
}

// 기둥 원점 기준 로컬 지오메트리 (기둥 + 도로 위 암 + 가로형 3구 하우징 2개 + 차양).
// 메인 하우징은 암 끝, 보조 하우징은 기둥 중간 (정지선 가까이에서도 보이도록).
function buildSignalGeometry(sc) {
  const h = sc.poleHeightM;
  const r = sc.lampRadiusM;
  const spacing = r * 2.6;
  const housingW = spacing * 3 + 0.1;
  const heads = [
    { x: sc.armLengthM - 0.7, y: h - 0.25 - 0.35 },
    { x: 0.75, y: 3.0 },
  ];

  const parts = [];
  const pole = new THREE.CylinderGeometry(0.12, 0.15, h, 8);
  pole.translate(0, h / 2, 0);
  parts.push(pole);
  const arm = new THREE.BoxGeometry(sc.armLengthM, 0.12, 0.12);
  arm.translate(sc.armLengthM / 2, h - 0.25, 0);
  parts.push(arm);
  for (const hd of heads) {
    const housing = new THREE.BoxGeometry(housingW, r * 2.6, 0.3);
    housing.translate(hd.x, hd.y, 0);
    parts.push(housing);
    for (let i = 0; i < 3; i++) {
      const v = new THREE.BoxGeometry(r * 2.1, 0.03, 0.22);
      v.translate(hd.x + (1 - i) * spacing, hd.y + r * 1.15, -0.25);
      parts.push(v);
    }
  }
  const bracket = new THREE.BoxGeometry(0.75, 0.08, 0.08);
  bracket.translate(0.37, heads[1].y, 0);
  parts.push(bracket);
  const metal = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

  // 램프: 운전자 시점 왼쪽부터 적·황·녹 (운전자 왼쪽 = 월드 +X). 운전자(-Z 쪽)를 향하게 배치.
  const lamps = {};
  ["red", "yellow", "green"].forEach((key, i) => {
    lamps[key] = mergeGeometries(
      heads.map((hd) => {
        const g = new THREE.CircleGeometry(r, 16);
        g.rotateY(Math.PI);
        g.translate(hd.x + (1 - i) * spacing, hd.y, -0.152);
        return g;
      })
    );
  });
  return { metal, lamps, heads, spacing };
}

function createSignalPoles(layouts, halfWidthM, signalGeo) {
  const mesh = new THREE.InstancedMesh(
    signalGeo.metal,
    new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.7 }),
    layouts.length
  );
  const dummy = new THREE.Object3D();
  layouts.forEach((L, i) => {
    dummy.position.copy(signalPolePosition(L, halfWidthM));
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

const LAMP_COLORS = { red: 0xff2a1a, yellow: 0xffb300, green: 0x19e05a };
const LAMP_ORDER = ["red", "yellow", "green"];

function createSignalLamps(L, halfWidthM, signalGeo) {
  const sc = L.cfg.signal;
  const group = new THREE.Group();
  group.position.copy(signalPolePosition(L, halfWidthM));

  const mats = {};
  for (const key of LAMP_ORDER) {
    mats[key] = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: LAMP_COLORS[key],
      emissiveIntensity: sc.unlitEmissiveIntensity,
      roughness: 0.4,
    });
    group.add(new THREE.Mesh(signalGeo.lamps[key], mats[key]));
  }

  let pointLight = null;
  if (sc.usePointLight) {
    pointLight = new THREE.PointLight(0xffffff, 0, 12);
    group.add(pointLight);
  }

  function setState(state) {
    for (const key of LAMP_ORDER) {
      mats[key].emissiveIntensity = key === state ? sc.litEmissiveIntensity : sc.unlitEmissiveIntensity;
    }
    if (pointLight) {
      const i = LAMP_ORDER.indexOf(state);
      const hd = signalGeo.heads[0];
      pointLight.color.setHex(LAMP_COLORS[state]);
      pointLight.intensity = sc.pointLightIntensity;
      pointLight.position.set(hd.x + (1 - i) * signalGeo.spacing, hd.y, -0.6);
    }
  }
  setState("green");

  return { group, setState };
}
