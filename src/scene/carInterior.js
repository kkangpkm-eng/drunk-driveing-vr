import * as THREE from "three";

const MAX_DISPLAY_KMH = 120;
const GAUGE_START_DEG = -135;
const GAUGE_SWEEP_DEG = 270;

// 1인칭 운전석 내부(대시보드, 핸들, 속도계)를 생성한다.
// 반환된 setSteerAngle/setSpeedKmh 로 매 프레임 시각적 상태를 갱신한다.
export function createCarInterior(config) {
  const group = new THREE.Group();
  const eyeY = config.cockpit.eyeHeightM;
  const dashTopY = eyeY - 0.375; // 대시보드 윗면 높이 (눈높이보다 아래)
  const dashFrontZ = 0.575; // 대시보드 앞면(카메라와 가장 가까운 면)

  group.add(createDashboard(eyeY, dashFrontZ));

  // 차량이 어느 방향을 향하든(태양 반대편이라도) 실내가 어둡게 묻히지 않도록
  // 대시보드 앞에 은은한 보조광을 둔다.
  const cockpitLight = new THREE.PointLight(0xffffff, 0.6, 3);
  cockpitLight.position.set(0, eyeY, 0.3);
  group.add(cockpitLight);

  const wheelGroup = createSteeringWheel();
  wheelGroup.position.set(0, eyeY - 0.35, 0.5); // 대시보드 앞면보다 카메라 쪽으로 더 가깝게
  group.add(wheelGroup);

  const { gaugeGroup, needleGroup } = createSpeedometer();
  gaugeGroup.position.set(-0.4, dashTopY + 0.05, 0.65); // 대시보드 윗면 위에 올려놓듯 배치
  group.add(gaugeGroup);

  return {
    group,
    setSteerAngle(angleRad) {
      wheelGroup.rotation.z = angleRad;
    },
    setSpeedKmh(speedKmh) {
      const frac = THREE.MathUtils.clamp(speedKmh / MAX_DISPLAY_KMH, 0, 1);
      const deg = GAUGE_START_DEG + frac * GAUGE_SWEEP_DEG;
      needleGroup.rotation.z = THREE.MathUtils.degToRad(deg);
    },
  };
}

function createDashboard(eyeY, dashFrontZ) {
  const depth = 0.35;
  const height = 0.35;
  const geo = new THREE.BoxGeometry(1.6, height, depth);
  const mat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, eyeY - 0.375, dashFrontZ + depth / 2);
  return mesh;
}

function createSteeringWheel() {
  const wheelGroup = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 24), rimMat);
  wheelGroup.add(rim);

  const hubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.05, 10);
  hubGeo.rotateX(Math.PI / 2);
  wheelGroup.add(new THREE.Mesh(hubGeo, rimMat));

  for (let i = 0; i < 3; i++) {
    const spokeGeo = new THREE.BoxGeometry(0.02, 0.16, 0.02);
    spokeGeo.translate(0, 0.09, 0);
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.z = (i / 3) * Math.PI * 2;
    wheelGroup.add(spoke);
  }

  return wheelGroup;
}

// 속도계: 텍스처 없이 순수 3D 도형(눈금+바늘)으로 구성해
// 시야각에 따른 평면 노멀/텍스처 반전 문제를 피한다.
function createSpeedometer() {
  const gaugeGroup = new THREE.Group();
  const tickMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0 });

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 6, 20), tickMat);
  gaugeGroup.add(ring);

  const tickCount = 7; // 0,20,40,60,80,100,120 km/h
  for (let i = 0; i < tickCount; i++) {
    const frac = i / (tickCount - 1);
    const angleRad = THREE.MathUtils.degToRad(GAUGE_START_DEG + frac * GAUGE_SWEEP_DEG);
    const r = 0.1;
    const tickGeo = new THREE.BoxGeometry(0.012, 0.03, 0.008);
    tickGeo.translate(0, r, 0);
    const tick = new THREE.Mesh(tickGeo, tickMat);
    tick.rotation.z = -angleRad;
    gaugeGroup.add(tick);
  }

  const needleGroup = new THREE.Group();
  const needleGeo = new THREE.BoxGeometry(0.01, 0.09, 0.006);
  needleGeo.translate(0, 0.045, 0);
  const needleMat = new THREE.MeshStandardMaterial({ color: 0xd23c3c });
  needleGroup.add(new THREE.Mesh(needleGeo, needleMat));
  gaugeGroup.add(needleGroup);

  return { gaugeGroup, needleGroup };
}
