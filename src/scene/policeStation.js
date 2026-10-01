import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// 출발 지점 경찰서 (본관·별관·담장/정문·국기 게양대·순찰차·주차장).
// 외부 모델 없이 기본 도형 + CanvasTexture만 사용한다.
// 같은 재질의 정적 도형은 병합하고, 반복되는 것(순찰차, 주차선)은 InstancedMesh로 그린다.
export function createPoliceStation(config) {
  const ps = config.policeStation;
  const group = new THREE.Group();

  group.add(createLot(ps));
  group.add(createParkingLines(ps));
  group.add(createWalls(ps, config.road.halfWidthM));

  const windowCanvas = createWindowCanvas();
  group.add(
    createBuilding(ps.mainBuilding, ps.wallColor, ps, windowCanvas, +1, ps.signText)
  );
  group.add(
    createBuilding(ps.annex, ps.annexWallColor, ps, windowCanvas, -1, ps.annexSignText)
  );

  group.add(createFlagpole(ps.flagpole));
  group.add(createPatrolCars(ps.patrolCars));

  return group;
}

// 경찰서 부지(주차장 포장면) 안에 있는지 — 차량 물리에서 도로 이탈 판정 예외로 사용.
export function isOnStationGrounds(x, z, config) {
  const { lot } = config.policeStation;
  return x >= lot.xMin && x <= lot.xMax && z >= lot.zMin && z <= lot.zMax;
}

// ── 공용 헬퍼 ─────────────────────────────────────────────────

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// 지오메트리 전체에 단색 버텍스 컬러를 입힌다 (여러 색 부품을 하나로 병합하기 위함).
function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

function makeCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ── 주차장 ──────────────────────────────────────────────────

function createLot(ps) {
  const { lot } = ps;
  const w = lot.xMax - lot.xMin;
  const d = lot.zMax - lot.zMin;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6d6e72, roughness: 1 }));
  mesh.position.set(lot.xMin + w / 2, 0.003, lot.zMin + d / 2);
  return mesh;
}

// 본관 앞 주차 구획선 (흰색 얇은 판, InstancedMesh)
function createParkingLines(ps) {
  const { mainBuilding: mb, parkingSpaceCount } = ps;
  const spaceWidth = 2.6;
  const lineLength = 5;
  const geo = new THREE.PlaneGeometry(0.12, lineLength);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  const count = parkingSpaceCount + 1;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const frontZ = mb.z + mb.depthM / 2;
  const x0 = mb.x - (parkingSpaceCount * spaceWidth) / 2;
  for (let i = 0; i < count; i++) {
    dummy.position.set(x0 + i * spaceWidth, 0.008, frontZ + 4 + lineLength / 2);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  return mesh;
}

// ── 담장 + 정문 ───────────────────────────────────────────────

function createWalls(ps, roadHalfWidthM) {
  const { lot, wall, gate } = ps;
  const h = wall.heightM;
  const t = wall.thicknessM;
  const frontX = -roadHalfWidthM - wall.insetFromRoadM; // 도로 쪽 담장 x
  const backX = lot.xMin + t / 2;
  const zMin = lot.zMin + t / 2;
  const zMax = lot.zMax - t / 2;
  const gz0 = gate.z - gate.widthM / 2;
  const gz1 = gate.z + gate.widthM / 2;

  const wallParts = [
    // 도로 쪽 담장 (정문 개구부로 둘로 나뉨)
    box(t, h, gz0 - zMin, frontX, h / 2, (zMin + gz0) / 2),
    box(t, h, zMax - gz1, frontX, h / 2, (gz1 + zMax) / 2),
    // 뒤쪽/양옆 담장
    box(t, h, zMax - zMin, backX, h / 2, (zMin + zMax) / 2),
    box(frontX - backX, h, t, (frontX + backX) / 2, h / 2, zMin),
    box(frontX - backX, h, t, (frontX + backX) / 2, h / 2, zMax),
  ].map((g) => paint(g, 0xd9d9d6));

  // 담장 위 파란 띠 (경찰서 상징색)
  const capH = 0.18;
  const capParts = [
    box(t + 0.06, capH, gz0 - zMin, frontX, h, (zMin + gz0) / 2),
    box(t + 0.06, capH, zMax - gz1, frontX, h, (gz1 + zMax) / 2),
  ].map((g) => paint(g, ps.bandColor));

  // 정문 기둥 2개
  const ph = gate.pillarHeightM;
  const pillarParts = [gz0 - 0.5, gz1 + 0.5].map((pz) => paint(box(0.9, ph, 1.0, frontX, ph / 2, pz), 0xbfc2c7));

  const group = new THREE.Group();
  const merged = mergeGeometries([...wallParts, ...capParts, ...pillarParts]);
  group.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));

  // 정문 기둥 표지판 — 도로 쪽(+X)과 부지 안쪽(-X) 양면에 붙인다.
  if (ps.gateSignText) {
    const tex = makeCanvasTexture(drawSignCanvas(ps.gateSignText, 512, 160, "#1f4e9c", "#ffffff"));
    const signGeo = new THREE.PlaneGeometry(0.85, 0.27);
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    const pz = gz0 - 0.5;
    for (const side of [1, -1]) {
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(frontX + side * 0.501, ph * 0.72, pz);
      sign.rotation.y = side * (Math.PI / 2);
      group.add(sign);
    }
  }
  return group;
}

// ── 건물 (본관/별관) ───────────────────────────────────────────

// 창문 한 칸(한 층 × 한 베이) 텍스처. 벽색은 흰색으로 그려두고 재질 color로 곱해서 흰/회색을 만든다.
function createWindowCanvas() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#8d949c"; // 창틀
  g.fillRect(14, 30, 100, 64);
  const grad = g.createLinearGradient(0, 34, 0, 90);
  grad.addColorStop(0, "#5f7f9c");
  grad.addColorStop(1, "#2f4458");
  g.fillStyle = grad; // 유리
  g.fillRect(18, 34, 92, 56);
  g.fillStyle = "#8d949c"; // 창살
  g.fillRect(62, 34, 4, 56);
  return c;
}

function windowTexture(canvas, repeatU, repeatV) {
  const tex = makeCanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatU, repeatV);
  return tex;
}

// facing: +1이면 정면이 +Z, -1이면 -Z
function createBuilding(spec, wallColor, ps, windowCanvas, facing, signText) {
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  if (facing < 0) group.rotation.y = Math.PI;

  const { widthM: w, depthM: d, heightM: h, floors } = spec;
  const bays = Math.max(1, Math.round(w / ps.windowBayWidthM));
  const sideBays = Math.max(1, Math.round(d / ps.windowBayWidthM));

  // BoxGeometry 면 순서: +X, -X, +Y, -Y, +Z, -Z
  const sideMat = new THREE.MeshStandardMaterial({ color: wallColor, map: windowTexture(windowCanvas, sideBays, floors), roughness: 0.9 });
  const frontMat = new THREE.MeshStandardMaterial({ color: wallColor, map: windowTexture(windowCanvas, bays, floors), roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9a9da3, roughness: 1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, roofMat, roofMat, frontMat, frontMat]);
  body.position.y = h / 2;
  group.add(body);

  // 파란 띠(1층 위 + 옥상 난간) + 회색 기단 + 현관 캐노피/출입문 — 한 메시로 병합
  const floorH = h / floors;
  const parts = [
    paint(box(w + 0.12, 0.45, d + 0.12, 0, floorH, 0), ps.bandColor),
    paint(box(w + 0.16, 0.7, d + 0.16, 0, h + 0.1, 0), ps.bandColor),
    paint(box(w + 0.06, 0.5, d + 0.06, 0, 0.25, 0), 0x8f9297),
    paint(box(Math.min(8, w * 0.35), 0.25, 2.4, 0, floorH * 0.82, d / 2 + 1.2), 0xdadde2), // 캐노피
    paint(box(Math.min(4.5, w * 0.2), floorH * 0.7, 0.08, 0, floorH * 0.35, d / 2 + 0.04), 0x24323f), // 유리문
  ];
  const trim = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  group.add(trim);

  // 간판 (CanvasTexture) — 정면 상단
  if (signText) {
    const signW = Math.min(w * 0.6, 3 + signText.length * 1.6);
    const signH = Math.max(1.0, signW * 0.16);
    const tex = makeCanvasTexture(drawSignCanvas(signText, 1024, Math.round(1024 * (signH / signW)), "#1f4e9c", "#ffffff"));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(0, h - floorH * 0.45, d / 2 + 0.06);
    group.add(sign);
  }
  return group;
}

// 파란 바탕 + 흰 글씨 간판 캔버스. 왼쪽에 단순화한 경찰 마크(원형 배지)를 그린다.
function drawSignCanvas(text, width, height, bg, fg) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const g = c.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = Math.max(2, height * 0.04);
  g.strokeRect(g.lineWidth, g.lineWidth, width - g.lineWidth * 2, height - g.lineWidth * 2);

  const r = height * 0.3;
  const bx = height * 0.55;
  g.fillStyle = "#f2c230";
  g.beginPath();
  g.arc(bx, height / 2, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = bg;
  g.beginPath();
  g.arc(bx, height / 2, r * 0.6, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const textLeft = bx + r * 1.4;
  const avail = width - textLeft - height * 0.25;
  let size = height * 0.62;
  g.font = `bold ${size}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  const measured = g.measureText(text).width;
  if (measured > avail) {
    size *= avail / measured;
    g.font = `bold ${size}px "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  }
  g.fillText(text, textLeft + avail / 2, height / 2 + size * 0.04);
  return c;
}

// ── 국기 게양대 ────────────────────────────────────────────────

function createFlagpole(spec) {
  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  const parts = [
    paint(new THREE.CylinderGeometry(0.06, 0.09, spec.heightM, 8).translate(0, spec.heightM / 2, 0), 0xe8e8e8),
    paint(new THREE.SphereGeometry(0.13, 8, 6).translate(0, spec.heightM + 0.1, 0), 0xd4af37),
    paint(box(1.2, 0.3, 1.2, 0, 0.15, 0), 0x9a9da3),
  ];
  group.add(new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));

  const flagW = 2.1;
  const flagH = 1.4;
  const flagGeo = new THREE.PlaneGeometry(flagW, flagH);
  flagGeo.translate(flagW / 2 + 0.07, 0, 0);
  const flag = new THREE.Mesh(
    flagGeo,
    new THREE.MeshStandardMaterial({ map: makeCanvasTexture(drawTaegukgi()), side: THREE.DoubleSide, roughness: 0.9 })
  );
  flag.position.y = spec.heightM - flagH / 2 - 0.2;
  flag.rotation.y = Math.PI / 2 + 0.3; // 도로 쪽에서 잘 보이도록
  group.add(flag);
  return group;
}

// 태극기 (단순화: 태극 문양 + 4괘)
function drawTaegukgi() {
  const W = 360;
  const H = 240;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, W, H);
  const cx = W / 2;
  const cy = H / 2;
  const R = H / 4;
  const tilt = Math.atan2(2, 3); // 대각선 기울기
  g.save();
  g.translate(cx, cy);
  g.rotate(tilt);
  g.fillStyle = "#cd2e3a";
  g.beginPath();
  g.arc(0, 0, R, Math.PI, 0);
  g.fill();
  g.fillStyle = "#0047a0";
  g.beginPath();
  g.arc(0, 0, R, 0, Math.PI);
  g.fill();
  g.fillStyle = "#cd2e3a";
  g.beginPath();
  g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#0047a0";
  g.beginPath();
  g.arc(R / 2, 0, R / 2, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // 4괘: [대각 방향 각도, 각 줄의 끊김 여부(3줄)]
  const trigrams = [
    [Math.PI + tilt, [false, false, false]], // 건 (좌상)
    [-tilt, [true, false, true]], // 감 (우상)
    [Math.PI - tilt, [false, true, false]], // 리 (좌하)
    [tilt, [true, true, true]], // 곤 (우하)
  ];
  g.fillStyle = "#000000";
  const barW = R * 1.0;
  const barH = R / 6;
  for (const [ang, broken] of trigrams) {
    g.save();
    g.translate(cx + Math.cos(ang) * R * 1.75, cy + Math.sin(ang) * R * 1.75);
    g.rotate(ang + Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const y = (i - 1) * barH * 1.5;
      if (broken[i]) {
        g.fillRect(-barW / 2, y - barH / 2, barW * 0.45, barH);
        g.fillRect(barW * 0.05, y - barH / 2, barW * 0.45, barH);
      } else {
        g.fillRect(-barW / 2, y - barH / 2, barW, barH);
      }
    }
    g.restore();
  }
  return c;
}

// ── 순찰차 ───────────────────────────────────────────────────

// 모든 부품을 버텍스 컬러로 칠해 하나의 지오메트리로 병합 → InstancedMesh 1개(드로우콜 1회)로 여러 대를 그린다.
function createPatrolCars(cars) {
  const L = 4.8;
  const W = 1.85;
  const parts = [
    paint(box(W, 0.75, L, 0, 0.7, 0), 0xf5f6f8), // 차체
    paint(box(W + 0.02, 0.16, L * 0.96, 0, 0.72, 0), 0x1f4e9c), // 파란 띠
    paint(box(W + 0.025, 0.06, L * 0.96, 0, 0.84, 0), 0xf2c230), // 노란 띠
    paint(box(W * 0.9, 0.55, L * 0.5, 0, 1.33, -0.2), 0x1d2630), // 유리(캐빈)
    paint(box(W * 0.86, 0.06, L * 0.42, 0, 1.63, -0.25), 0xf5f6f8), // 지붕
    paint(box(0.55, 0.14, 0.3, -0.3, 1.73, -0.25), 0xd92b2b), // 경광등(적)
    paint(box(0.55, 0.14, 0.3, 0.3, 1.73, -0.25), 0x2b55d9), // 경광등(청)
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12);
      wheel.rotateZ(Math.PI / 2);
      wheel.translate(sx * (W / 2 - 0.08), 0.34, sz * L * 0.32);
      parts.push(paint(wheel, 0x151515));
    }
  }
  // 병합 전 index/non-index를 맞춘다 (Cylinder/Box 모두 indexed라 그대로 병합 가능)
  const merged = mergeGeometries(parts);
  const mesh = new THREE.InstancedMesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }), cars.length);
  const dummy = new THREE.Object3D();
  cars.forEach((car, i) => {
    dummy.position.set(car.x, 0, car.z);
    dummy.rotation.y = car.heading;
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}
