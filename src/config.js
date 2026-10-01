// 게임 전반의 조정 수치를 한 곳에 모은 설정 파일.
// 체감(운전 느낌, 난이도)을 바꾸고 싶을 때는 이 파일의 값만 수정하면 된다.

export const config = {
  // ── 차량 물리 ──────────────────────────────────────────────
  vehicle: {
    maxSpeedKmh: 110, // 최고 속도 (km/h)
    accelerationMps2: 3.2, // 엑셀 최대 시 가속도 (m/s^2)
    brakeDecelerationMps2: 7.5, // 브레이크 최대 시 감속도 (m/s^2)
    naturalDragMps2: 0.6, // 입력이 없을 때 자연 감속도 (엔진 브레이크/저항)
    maxYawRateRadPerSec: 0.9, // 조향 최대 각속도 (rad/s), 저속 기준
    steeringSpeedSensitivity: 0.6, // 속도가 높아질수록 조향 각속도를 얼마나 낮출지 (0~1)
    minSteeringSensitivityFactor: 0.35, // 고속에서도 남겨둘 최소 조향 감도 비율
    // 차체 크기 (운전자 눈 위치 = 차량 그룹 원점 기준). 정지선 판정/보행자 충돌에 사용.
    frontOffsetM: 2.0, // 운전자 위치 → 앞범퍼까지 거리
    rearOffsetM: 2.6, // 운전자 위치 → 뒷범퍼까지 거리
    halfWidthM: 0.9, // 차폭의 절반
  },

  // ── 코스 시작 (경찰서 주차장 출발) ─────────────────────────────
  // 좌표계: 도로 진행 방향 = +Z, 운전자 기준 오른쪽 = -X.
  // heading: 0 = +Z(도로 진행 방향), Math.PI/2 = +X(정문 → 도로 쪽).
  course: {
    startX: -56,
    startZ: -26, // startHeadingRad로 직진하면 정문 중앙을 지나도록 맞춘 값
    startHeadingRad: Math.PI / 2 + 0.12, // 정문을 향하되 본관이 시야 왼쪽에 보이도록 약간 틀어둠
  },

  // ── 도로 ──────────────────────────────────────────────────
  road: {
    startZ: -90, // 도로가 시작되는 z (경찰서 정문보다 뒤쪽까지 깔아 합류 구간 확보)
    totalLengthM: 1800, // 코스 총 길이 (m)
    halfWidthM: 4, // 도로 중심선에서 도로 끝까지 거리 (한쪽 2차로 폭의 절반)
    offRoadDragMultiplier: 3, // 도로를 벗어났을 때 추가 감속 배수
    offRoadShakeAmplitude: 0.04, // 도로 이탈 시 카메라(차체) 진동 폭
  },

  // ── 1인칭 시점(운전석) ─────────────────────────────────────
  cockpit: {
    eyeHeightM: 1.15, // 좌석 기준 눈높이
    eyeForwardOffsetM: 0.1, // 좌석 기준 눈의 전방 위치
    steeringWheelMaxAngleRad: Math.PI * 0.75, // 조향 입력 -1~1에 대응하는 핸들 회전 최대각
  },

  // ── 카메라/렌더링 ───────────────────────────────────────────
  render: {
    fov: 70,
    near: 0.1,
    far: 2000,
    fogNearM: 60,
    fogFarM: 420,
  },

  // ── 출발 지점 경찰서 ──────────────────────────────────────────
  // 도로 오른쪽(-X) 부지. 모든 좌표는 월드 좌표(m).
  policeStation: {
    signText: "○○경찰서", // 본관 간판 문구
    gateSignText: "○○경찰서", // 정문 기둥 표지판 문구
    annexSignText: "민원실", // 별관 간판 문구 (빈 문자열이면 생략)
    // 주차장(포장 부지) — 이 안에서는 도로 이탈로 판정하지 않는다. xMax는 도로 끝(-road.halfWidthM)과 맞닿게.
    lot: { xMin: -66, xMax: -4, zMin: -84, zMax: -4 },
    wall: { heightM: 1.6, thicknessM: 0.3, insetFromRoadM: 3 }, // 담장 (도로 쪽은 도로 끝에서 insetFromRoadM 안쪽)
    gate: { z: -32, widthM: 9, pillarHeightM: 2.6 }, // 정문 (도로 쪽 담장의 개구부)
    mainBuilding: { x: -30, z: -68, widthM: 32, depthM: 14, heightM: 14, floors: 4 }, // 정면은 +Z(주차장) 방향
    annex: { x: -52, z: -12, widthM: 18, depthM: 10, heightM: 8, floors: 2 }, // 정면은 -Z(주차장) 방향
    wallColor: 0xf4f4f2, // 본관 벽(흰색)
    annexWallColor: 0xc9cbcf, // 별관 벽(회색)
    bandColor: 0x1f4e9c, // 파란 띠
    windowBayWidthM: 3.2, // 창문 텍스처 한 칸 가로 폭
    flagpole: { x: -10, z: -52, heightM: 10 },
    // 주차된 순찰차 (heading: 0 = +Z)
    patrolCars: [
      { x: -36.5, z: -54, heading: Math.PI },
      { x: -33.9, z: -54, heading: Math.PI },
    ],
    parkingSpaceCount: 8, // 본관 앞 주차 구획선 개수
  },

  // ── 신호등 횡단보도 (코스 전체 5곳) ───────────────────────────
  // crosswalks[]의 각 항목이 횡단보도 1곳. z는 반드시 도로의 직선 구간
  // (road.js CURVE_SEGMENTS: 0~250, 500~950, 1250~1550, 1750~1800)에 둘 것.
  // crossRoad: true면 교차 도로가 있는 교차로, false면 도로 중간의 단독 횡단보도.
  // signal: 항목별로 아래 crosswalkDefaults.signal 값을 덮어쓸 수 있다 (예: 녹색 유지 시간을 달리해서 예측하기 어렵게).
  crosswalks: [
    { z: 160, crossRoad: false, signal: { greenHoldS: 0.4 } },
    { z: 600, crossRoad: true, signal: { greenHoldS: 1.6 } },
    { z: 860, crossRoad: true, signal: { greenHoldS: 0.2 } },
    { z: 1330, crossRoad: false, signal: { greenHoldS: 1.0 } },
    { z: 1500, crossRoad: true, signal: { greenHoldS: 0.6 } },
  ],
  crosswalkDefaults: {
    // 단독 횡단보도는 z가 횡단보도 중심, 교차로는 z가 교차 도로 중심
    crossRoadHalfWidthM: 4, // 교차 도로 폭의 절반
    crossRoadLengthM: 160, // 교차 도로 전체 길이
    crosswalk: {
      lengthM: 4, // 횡단보도 폭(진행 방향 길이)
      gapToCrossRoadM: 1.5, // 횡단보도와 교차 도로 사이 간격 (교차로만)
      stripeWidthM: 0.5,
      stripeGapM: 0.5,
      heightAboveRoadM: 0.01, // 도로면보다 1cm 위 (z-fighting 방지)
    },
    stopLine: { distanceBeforeCrosswalkM: 2.5, widthM: 0.45 },
    sidewalkPadM: 3, // 횡단보도 양 끝 보도 블록 크기
    signal: {
      triggerDistanceM: 75, // 차 앞부분이 정지선에서 이 거리 안에 들어오면 신호 전환 시작
      greenHoldS: 0.6, // 트리거 후 녹색 유지 시간
      yellowDurationS: 3.0, // 황색 시간
      redDurationS: 11, // 적색 시간 (보행자 횡단이 끝날 만큼, 이후 다시 녹색)
      poleHeightM: 5.6,
      armLengthM: 5.5, // 기둥에서 도로 쪽으로 뻗는 가로 암 길이
      lampRadiusM: 0.15,
      litEmissiveIntensity: 3.0, // 점등 밝기 (emissive)
      unlitEmissiveIntensity: 0.04, // 소등 시 희미한 잔광
      usePointLight: false, // true면 켜진 등 위치에 PointLight 1개만 추가 (모바일 성능상 기본 끔)
      pointLightIntensity: 2,
    },
  },

  // ── 보행자 ───────────────────────────────────────────────────
  // 적색 신호가 켜지면 횡단보도를 건넌다. 일반/음주 모드 모두 동일 조건.
  // 횡단보도마다 아래 list가 그대로 배치된다 (crosswalks[i].pedestrians로 개별 지정 가능).
  pedestrians: {
    useGltf: true, // false면 기본 도형 캐릭터(사인파 팔다리)를 사용
    walkSpeedMps: 1.3, // 보행 속도 (m/s)
    heightM: 1.7, // 캐릭터 키 (모델을 이 높이로 스케일)
    walkAnimTimeScale: 1.3, // 걷기 애니메이션 재생 속도 (발 미끄러짐 보정)
    waitOffsetFromRoadEdgeM: 1.2, // 도로 끝에서 바깥쪽으로 대기 위치까지 거리
    collisionRadiusM: 0.35,
    blockedMinCarSpeedMps: 0.8, // 차가 이 속도 미만이면 충돌 대신 보행자가 멈춰서 기다림
    activeDistanceM: 260, // 운전자와 이 거리 이내의 보행자만 애니메이션 갱신/표시 (성능)
    // startSide: "right"(운전자 기준 오른쪽, -X) | "left"
    // offsetInCrosswalkM: 횡단보도 안에서 정지선 쪽 끝으로부터의 거리
    list: [
      { model: "character-male-b.glb", startSide: "right", delayAfterRedS: 0.8, offsetInCrosswalkM: 1.3 },
      { model: "character-female-c.glb", startSide: "right", delayAfterRedS: 2.0, offsetInCrosswalkM: 2.7 },
    ],
  },

  // ── 앞차 급정거 돌발 상황 ───────────────────────────────────────
  // 운전자가 spawnWhenPlayerZ를 지나면 앞쪽 spawnAheadM 지점에 앞차가 나타나 같은 차로를 달리다가,
  // brakeAtZ에서 급정거한다. 일반/음주 모드 모두 같은 위치에서 발생.
  leadCar: {
    enabled: true,
    spawnWhenPlayerZ: 900,
    spawnAheadM: 110,
    approachSpeedKmh: 35, // 운전자가 따라붙기 전까지 앞차 속도 (느리게 달려 거리가 좁혀지게)
    followGapM: 22, // 따라붙은 뒤 유지하려는 차간 거리
    minSpeedKmh: 30,
    maxSpeedKmh: 70,
    accelMps2: 2.0, // 평소 가감속 한계
    brakeAtZ: 1120, // 급정거 시작 지점 (곡선 구간)
    brakeDecelMps2: 8.0, // 급정거 감속도
    stopHoldS: 3.0, // 정지 후 대기 시간
    resumeSpeedKmh: 60,
    laneOffsetM: -2, // 도로 중심선 기준 x 오프셋 (운전자 차로 = 오른쪽 차로)
    lengthM: 4.6,
    widthM: 1.8,
    bodyColor: 0x9a2a2a,
    despawnAheadM: 260, // 운전자보다 이만큼 앞서가면 사라짐
  },

  // ── 측정 ────────────────────────────────────────────────────
  measurement: {
    brakeReactionThreshold: 0.2, // 원래 브레이크 입력이 이 값 이상이면 "반응"으로 판정
    reactionTimeoutS: 5, // 이 시간 안에 반응이 없으면 반응 실패로 기록
    stoppedSpeedMps: 0.3, // 이 속도 미만이면 정지로 판정 (정지거리 측정)
  },

  // ── 충돌 피드백 (사실적 묘사 없이 화면 점멸 + 경고음만) ────────────
  collisionFeedback: {
    flashColor: 0xff1a1a,
    flashMaxOpacity: 0.55,
    flashDurationS: 1.4,
    flashCount: 3,
    beepFrequenciesHz: [880, 660], // 번갈아 울리는 경고음 주파수
    beepDurationS: 0.9,
    beepVolume: 0.25,
    stopVehicle: true, // 충돌 시 차량 정지
  },

  // ── 게임패드 (블루투스 컨트롤러, 브라우저 "standard" 배치 기준) ──────
  // 버튼 번호: 0=아래(스위치 B/엑스박스 A), 1=오른쪽(스위치 A), 2=왼쪽, 3=위,
  // 6=ZL/LT, 7=ZR/RT, 8=−/Select, 9=+/Start, 12~15=방향키(상하좌우)
  gamepad: {
    steerAxis: 0, // 왼쪽 스틱 좌우
    steerDeadzone: 0.12,
    steerCurve: 1.6, // 1보다 크면 스틱 중앙 부근이 더 섬세해짐
    throttleButton: 7, // ZR
    brakeButton: 6, // ZL
    pedalAxis: 3, // 오른쪽 스틱 상하 (위=가속, 아래=브레이크). -1이면 사용 안 함
    pedalDeadzone: 0.15,
    // 스위치 ZL/ZR처럼 디지털(0/1)인 버튼은 키보드처럼 서서히 올라가게 보간
    digitalRampUpPerSec: 3.0,
    digitalRampDownPerSec: 4.5,
    confirmButtons: [0, 1], // 메뉴 선택 (스위치 A/B 어느 쪽을 눌러도 선택)
    backButtons: [8], // 메뉴 뒤로
    pauseButtons: [9], // 주행 중 일시정지
    recenterButtons: [3], // VR 시점 정면 재설정
    menuStickThreshold: 0.6,
  },

  // ── VR (카드보드형 고글) ─────────────────────────────────────────
  vr: {
    preferWebXR: true, // WebXR(immersive-vr)이 지원되면 사용, 아니면 화면 분할 + 자이로 방식
    stereoEyeSeparationM: 0.064, // 화면 분할 방식의 양안 간격
    stereoFovDeg: 85, // 화면 분할 방식의 세로 시야각 (카드보드 렌즈에 맞게)
    pixelRatio: 1.0, // VR 중 렌더 해상도 배율 (성능)
    vignetteInnerDeg: 26, // VR용 터널 비전: 이 각도까지는 투명
    vignetteOuterDeg: 62, // 이 각도부터 완전히 어두움
    blurInStereo: true, // 화면 분할 방식에서 블러(CSS) 사용 여부. WebXR에서는 항상 끔
  },

  // ── 3D 메뉴/알림 패널 (VR에서도 보이도록 장면 안에 그린다) ───────────
  ui: {
    menuDistanceM: 1.9, // 운전자 눈 앞 메뉴 패널 거리
    menuWidthM: 1.9,
    toastDistanceM: 3.0,
    toastHeightOffsetM: 0.35, // 눈높이 기준 알림 높이
    toastDurationS: 2.0,
  },

  // ── 개발용 고정 시점 (?view=station | intersection | pedestrian) ───
  // intersection/pedestrian 시점은 viewCrosswalkIndex 번째 횡단보도 기준 상대 좌표 (URL ?cw=번호로 변경 가능)
  debugViews: {
    viewCrosswalkIndex: 1,
    station: { position: [14, 16, 0], lookAt: [-32, 2, -48] },
    intersection: { position: [14, 9, -40], lookAt: [0, 1, -8] },
    pedestrian: { position: [6, 3.2, -24], lookAt: [-1, 0.8, -12] },
  },

  // ── 음주 모드 ────────────────────────────────────────────────
  // intensity(0~1)가 아래 모든 효과의 크기에 비례해서 곱해진다.
  // 일반 모드에서는 intensity가 항상 0으로 취급되어 효과가 전부 꺼진다.
  drunk: {
    intensity: 1.0,

    // 입력 지연 (버퍼에 저장했다가 지정 시간만큼 늦게 차량에 반영)
    inputDelay: {
      throttleMs: 300,
      brakeMs: 600,
      steerMs: 400,
    },

    // 조향 부정확성
    steering: {
      sensitivityFactor: 0.7, // 입력 대비 실제 반영 비율
      reactionTimeConstantS: 0.35, // 목표 조향값을 얼마나 천천히 따라가는지 (반응 둔화)
      noiseAmplitude: 0.06, // 저주파 노이즈로 인한 좌우 흔들림 크기 (-1~1 스케일)
      noiseFreq1RadPerSec: 0.8,
      noiseFreq2RadPerSec: 1.3,
      oversteerTriggerDelta: 0.18, // 최근 평균 대비 이 이상 급격히 바뀌면 과조향 발동
      oversteerRefTauS: 0.15, // "최근 평균"을 계산하는 시간 상수
      oversteerAmount: 0.35, // 과조향(오버슈트) 최대 크기
      oversteerDurationS: 0.35, // 과조향이 원래대로 돌아오는 데 걸리는 시간
    },

    // 브레이크 부정확성 (지연 외 추가로 약하게 반영)
    brake: {
      effectivenessFactor: 0.8,
    },

    // 시각 효과 — 항목별로 켜고 끌 수 있다.
    visual: {
      lowSpecMode: false, // true면 이중시야/블러를 끄고 흔들림+비네팅만 적용
      swayEnabled: true,
      swayPeriodS: 5, // 좌우 흔들림 한 주기 (4~6초 권장)
      swayAmplitudeDeg: 3, // 흔들림 최대 기울기(도)
      doubleVisionEnabled: true,
      doubleVisionDamp: 0.85, // 잔상 잔류 정도 (0~1, 클수록 오래 남음)
      blurEnabled: true,
      blurPeriodS: 3.5, // 블러가 강해졌다 약해지는 주기
      blurMaxPixels: 2.5, // 최대 블러 강도(px)
      vignetteEnabled: true,
      vignetteMaxOpacity: 0.85, // 터널 비전 최대 진하기
    },
  },
};
