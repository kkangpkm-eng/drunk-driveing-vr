import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { roadCenterX } from "./road.js";
import { getCrosswalkLayouts } from "./intersectionLayout.js";

// 배경(잔디, 가로수, 가로등, 건물)을 인스턴싱으로 생성한다.
// 외부 3D 모델 없이 기본 도형(Box/Cylinder/Cone/Sphere)만 사용.
export function createEnvironment(config) {
  const group = new THREE.Group();
  const { totalLengthM, halfWidthM, startZ } = config.road;
  // 횡단보도/교차로 주변(정지선~교차 도로)에는 배경 오브젝트를 두지 않는다.
  const layouts = getCrosswalkLayouts(config);
  const isClear = (z, margin = 0) => layouts.some((L) => z > L.clearZMin - margin && z < L.clearZMax + margin);

  group.add(createGround(startZ, totalLengthM));
  group.add(createLampPosts(totalLengthM, halfWidthM, isClear));
  group.add(createTrees(totalLengthM, halfWidthM, isClear));
  group.add(createBuildings(totalLengthM, halfWidthM, isClear));

  return group;
}

function createGround(startZ, totalLengthM) {
  const length = totalLengthM - startZ + 200;
  const geo = new THREE.PlaneGeometry(600, length, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, roughness: 1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.02, startZ - 100 + length / 2);
  return mesh;
}

// 가로등: 기둥(Cylinder) + 등 머리(Box) 프로토타입을 병합한 뒤 InstancedMesh로 반복 배치.
function createLampPosts(totalLengthM, halfWidthM, isClear) {
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6);
  poleGeo.translate(0, 3, 0);
  const headGeo = new THREE.BoxGeometry(0.5, 0.3, 0.5);
  headGeo.translate(0, 6, 0.2);
  const merged = mergeGeometries([poleGeo, headGeo]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, emissive: 0x554422, emissiveIntensity: 0.3 });

  const spacing = 40;
  const total = Math.floor(totalLengthM / spacing);
  const slots = [];
  for (let i = 0; i < total; i++) if (!isClear(i * spacing + 20, 1)) slots.push(i);
  const count = slots.length;
  const mesh = new THREE.InstancedMesh(merged, mat, count);
  const dummy = new THREE.Object3D();
  for (let n = 0; n < count; n++) {
    const i = slots[n];
    const z = i * spacing + 20;
    const side = i % 2 === 0 ? 1 : -1;
    const x = roadCenterX(z) + side * (halfWidthM + 1.5);
    dummy.position.set(x, 0, z);
    dummy.rotation.y = side > 0 ? Math.PI : 0;
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
  }
  return mesh;
}

// 가로수: 나무 기둥(Cylinder) + 수관(Cone) 병합 후 크기를 다양화해 배치.
function createTrees(totalLengthM, halfWidthM, isClear) {
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
  trunkGeo.translate(0, 1, 0);
  const leafGeo = new THREE.ConeGeometry(1.2, 2.6, 7);
  leafGeo.translate(0, 3, 0);
  const merged = mergeGeometries([trunkGeo, leafGeo]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 1 });

  const spacing = 22;
  const count = Math.floor(totalLengthM / spacing) * 2;
  const mesh = new THREE.InstancedMesh(merged, mat, count);
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let z = 15; z < totalLengthM; z += spacing) {
    for (const side of [1, -1]) {
      if (idx >= count) break;
      if (isClear(z + ((z * 7) % 5), 2)) continue;
      const jitter = (Math.sin(z * 0.37 + side) * 0.5 + 0.5) * 3;
      const x = roadCenterX(z) + side * (halfWidthM + 5 + jitter);
      const scale = 0.8 + ((z * 13) % 10) / 20;
      dummy.position.set(x, 0, z + ((z * 7) % 5));
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  mesh.count = idx; // 교차로 때문에 건너뛴 슬롯은 그리지 않는다
  return mesh;
}

// 건물: 단순 Box를 크기와 색을 달리해 도로 양옆 먼 곳에 배치.
function createBuildings(totalLengthM, halfWidthM, isClear) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });

  const spacing = 55;
  const count = Math.floor(totalLengthM / spacing) * 2;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let idx = 0;
  for (let z = 30; z < totalLengthM; z += spacing) {
    for (const side of [1, -1]) {
      if (idx >= count) break;
      if (isClear(z, 10)) continue;
      const width = 8 + ((z * 3) % 10);
      const depth = 8 + ((z * 5) % 8);
      const height = 6 + ((z * 11) % 22);
      const x = roadCenterX(z) + side * (halfWidthM + 12 + ((z * 2) % 6));
      dummy.position.set(x, 0, z);
      dummy.scale.set(width, height, depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      const shade = 0.55 + (((z * 17) % 10) / 10) * 0.35;
      color.setRGB(shade * 0.85, shade * 0.87, shade * 0.9);
      mesh.setColorAt(idx, color);
      idx++;
    }
  }
  mesh.count = idx; // 교차로 때문에 건너뛴 슬롯은 그리지 않는다
  return mesh;
}
