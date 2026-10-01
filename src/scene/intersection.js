import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getIntersectionLayout } from "./intersectionLayout.js";
import { SIDEWALK_PAD_HEIGHT_M } from "../traffic/pedestrians.js";

// 교차 도로 + 횡단보도 + 정지선 + 보도 블록 + 신호등(기둥/암/3구 등).
// 신호등 점등은 emissive 재질의 밝기만 바꿔서 표현한다 (PointLight는 옵션, 기본 끔).
export function createIntersection(config) {
  const it = config.intersection;
  const { halfWidthM } = config.road;
  const L = getIntersectionLayout(config);
  const group = new THREE.Group();

  // ── 교차 도로 (본 도로보다 살짝 아래 → 겹치는 부분은 본 도로가 덮음) ──
  const crossGeo = new THREE.PlaneGeometry(it.crossRoadLengthM, L.crossHalf * 2);
  crossGeo.rotateX(-Math.PI / 2);
  const crossRoad = new THREE.Mesh(crossGeo, new THREE.MeshStandardMaterial({ color: 0x3a3a3d, roughness: 1 }));
  crossRoad.position.set(L.cx, -0.006, L.z);
  group.add(crossRoad);

  // ── 횡단보도 줄무늬 (InstancedMesh, 도로면 + heightAboveRoadM) ──
  const cw = it.crosswalk;
  const stripePitch = cw.stripeWidthM + cw.stripeGapM;
  const stripeCount = Math.floor((halfWidthM * 2 - cw.stripeGapM) / stripePitch);
  const stripeGeo = new THREE.PlaneGeometry(cw.stripeWidthM, cw.lengthM);
  stripeGeo.rotateX(-Math.PI / 2);
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f0 });
  const stripes = new THREE.InstancedMesh(stripeGeo, whiteMat, stripeCount);
  const dummy = new THREE.Object3D();
  const usedWidth = stripeCount * stripePitch - cw.stripeGapM;
  const firstX = L.cx - usedWidth / 2 + cw.stripeWidthM / 2;
  const cwCenterZ = (L.crosswalkNearZ + L.crosswalkFarZ) / 2;
  for (let i = 0; i < stripeCount; i++) {
    dummy.position.set(firstX + i * stripePitch, cw.heightAboveRoadM, cwCenterZ);
    dummy.updateMatrix();
    stripes.setMatrixAt(i, dummy.matrix);
  }
  group.add(stripes);

  // ── 정지선 (진행 차로 = 운전자 오른쪽 차로만, 중앙선~도로 오른쪽 끝) ──
  const sl = it.stopLine;
  const stopGeo = new THREE.PlaneGeometry(halfWidthM, sl.widthM);
  stopGeo.rotateX(-Math.PI / 2);
  const stopLine = new THREE.Mesh(stopGeo, whiteMat);
  // 정지선 판정 z(L.stopLineZ)가 정지선의 "앞쪽 끝"이 되도록 배치
  stopLine.position.set(L.cx - halfWidthM / 2, cw.heightAboveRoadM, L.stopLineZ - sl.widthM / 2);
  group.add(stopLine);

  // ── 보도 블록 (횡단보도 양 끝, 보행자 대기 위치) ──
  const pad = it.sidewalkPadM;
  const padParts = [-1, 1].map((side) => {
    const g = new THREE.BoxGeometry(pad, SIDEWALK_PAD_HEIGHT_M, cw.lengthM + 2);
    g.translate(L.cx + side * (halfWidthM + pad / 2), SIDEWALK_PAD_HEIGHT_M / 2, cwCenterZ);
    return g;
  });
  group.add(new THREE.Mesh(mergeGeometries(padParts), new THREE.MeshStandardMaterial({ color: 0xb8b3a8, roughness: 1 })));

  const signal = createSignalHead(config, L);
  group.add(signal.group);

  return { group, layout: L, setSignalState: signal.setState };
}

// 신호등: 교차로 건너편 오른쪽 모서리 기둥 + 도로 위로 뻗은 암 + 가로형 3구 등(적·황·녹).
// 운전자가 정지선에 가까이 왔을 때도 보이도록 기둥 중간에 보조 신호등을 하나 더 단다.
// 두 신호등은 같은 재질을 공유하므로 상태 전환 시 재질 3개만 바꾸면 된다.
function createSignalHead(config, L) {
  const sc = config.intersection.signal;
  const { halfWidthM } = config.road;
  const group = new THREE.Group();

  const poleX = L.cx - halfWidthM - 1.2;
  const poleZ = L.z + L.crossHalf + 1.2;
  const h = sc.poleHeightM;

  const metalParts = [];
  const pole = new THREE.CylinderGeometry(0.12, 0.15, h, 8);
  pole.translate(poleX, h / 2, poleZ);
  metalParts.push(pole);
  const arm = new THREE.BoxGeometry(sc.armLengthM, 0.12, 0.12);
  arm.translate(poleX + sc.armLengthM / 2, h - 0.25, poleZ);
  metalParts.push(arm);

  // 등 하우징 위치 (메인: 암 끝, 보조: 기둥 중간)
  const heads = [
    { x: poleX + sc.armLengthM - 0.7, y: h - 0.25 - 0.35 },
    { x: poleX + 0.75, y: 3.0 },
  ];
  const r = sc.lampRadiusM;
  const spacing = r * 2.6;
  const housingW = spacing * 3 + 0.1;
  for (const hd of heads) {
    const housing = new THREE.BoxGeometry(housingW, r * 2.6, 0.3);
    housing.translate(hd.x, hd.y, poleZ);
    metalParts.push(housing);
    // 차양(바이저) — 등 위쪽
    for (let i = 0; i < 3; i++) {
      const v = new THREE.BoxGeometry(r * 2.1, 0.03, 0.22);
      v.translate(hd.x + (1 - i) * spacing, hd.y + r * 1.15, poleZ - 0.25);
      metalParts.push(v);
    }
  }
  // 보조 신호등을 기둥에 연결하는 짧은 브래킷
  const bracket = new THREE.BoxGeometry(0.75, 0.08, 0.08);
  bracket.translate(poleX + 0.37, heads[1].y, poleZ);
  metalParts.push(bracket);

  group.add(new THREE.Mesh(mergeGeometries(metalParts), new THREE.MeshStandardMaterial({ color: 0x2a2c2f, roughness: 0.7 })));

  // 램프 3종 재질 (운전자 시점 왼쪽부터 적·황·녹. 운전자 왼쪽 = 월드 +X)
  const colors = { red: 0xff2a1a, yellow: 0xffb300, green: 0x19e05a };
  const mats = {};
  const lampGeos = { red: [], yellow: [], green: [] };
  const order = ["red", "yellow", "green"];
  for (const hd of heads) {
    order.forEach((key, i) => {
      const g = new THREE.CircleGeometry(r, 16);
      g.rotateY(Math.PI); // 운전자(-Z 쪽)를 향하게
      g.translate(hd.x + (1 - i) * spacing, hd.y, poleZ - 0.152);
      lampGeos[key].push(g);
    });
  }
  const lampMeshes = {};
  for (const key of order) {
    mats[key] = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: colors[key],
      emissiveIntensity: sc.unlitEmissiveIntensity,
      roughness: 0.4,
    });
    lampMeshes[key] = new THREE.Mesh(mergeGeometries(lampGeos[key]), mats[key]);
    group.add(lampMeshes[key]);
  }

  let pointLight = null;
  if (sc.usePointLight) {
    pointLight = new THREE.PointLight(0xffffff, 0, 12);
    group.add(pointLight);
  }

  function setState(state) {
    for (const key of order) {
      mats[key].emissiveIntensity = key === state ? sc.litEmissiveIntensity : sc.unlitEmissiveIntensity;
    }
    if (pointLight) {
      const i = order.indexOf(state);
      pointLight.color.setHex(colors[state]);
      pointLight.intensity = sc.pointLightIntensity;
      pointLight.position.set(heads[0].x + (1 - i) * spacing, heads[0].y, poleZ - 0.6);
    }
  }
  setState("green");

  return { group, setState };
}
