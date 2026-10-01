# 음주운전 체험 VR 게임 (프로토타입)

경찰 교통안전 홍보·교육용 음주운전 위험성 체험 게임입니다. 같은 코스를 일반 모드와
음주 모드로 각각 주행하고 결과를 비교해 음주운전의 위험성을 체감하게 합니다.

현재 **2단계: 음주 모드 효과**까지 구현되어 있습니다.

## 실행 방법

```bash
npm install
npm run dev
```

터미널에 표시되는 주소(기본 `http://localhost:5173`)를 PC 크롬으로 엽니다.

개발 중 특정 모드로 바로 시작하려면 URL 파라미터를 사용합니다.

- `http://localhost:5173/?mode=normal` — 일반 모드로 시작 (기본값)
- `http://localhost:5173/?mode=drunk` — 음주 모드로 시작

## 조작법 (PC / 키보드, 테스트용)

| 키 | 동작 |
| --- | --- |
| ↑ / W | 가속 |
| ↓ / S | 브레이크 |
| ← / A, → / D | 조향 |
| R | 재시작 (차량을 코스 시작 지점으로 리셋) |
| M | 일반 ↔ 음주 모드 전환 (개발용) |
| I | 입력 디버그 오버레이 켜기/끄기 (개발용) |
| T | 결과 비교 화면 열기/닫기 (코스 끝에 도착하면 자동으로 열림) |

※ V(VR 토글), 게임패드 조작은 다음 단계에서 추가됩니다.

## 1단계에서 구현된 내용

- Vite + Three.js 기반 프로젝트 골격
- 완만한 커브 3개를 포함한 편도 2차로 도로 (중앙 점선 + 갓길 실선)
- 로우폴리 배경: 가로수, 가로등, 건물 (모두 Three.js 기본 도형 + 인스턴싱)
- 1인칭 운전석 시점: 대시보드, 조향 입력에 따라 실제로 회전하는 핸들, 바늘이 움직이는 속도계
- 아케이드식 차량 물리: 가속/제동/조향, 고속일수록 조향 감도 저하, 도로 이탈 시 감속+진동
- 키보드 입력을 부드럽게 보간하는 입력 모듈
- 최소한의 HUD: 속도(km/h), 모드 표시, 진행률 바

## 2단계에서 추가된 내용

- **입력 지연 버퍼** (`src/input/inputDelayBuffer.js`): 모든 입력을 타임스탬프와 함께
  저장해두고, 채널(가속/브레이크/조향)별로 지정된 시간만큼 과거 값을 보간해서 꺼내온다.
- **조향/브레이크 부정확성** (`src/vehicle/drunkControl.js`): 지연된 조향값에 감도 저하,
  저주파 노이즈, 급격한 입력 변화 시 과조향(오버슈트), 반응 둔화(느린 추종)를 적용.
  브레이크는 지연 외에 추가로 약하게만 반영된다.
- **핸들 시각화**: 실내의 핸들은 원래 입력이 아니라 지연·왜곡을 모두 거친 "실제로 차에
  반영된 값"을 따라 회전한다 — 입력보다 늦고 부정확하게 도는 모습이 그대로 보인다.
- **시각 효과** (`src/effects/`):
  - 바깥 풍경 좌우 흔들림·기울어짐 (`drunkSway.js`) — 카메라/대시보드/핸들은 전혀 흔들리지
    않고, 차량 그룹 전체를 굴려서 상대적으로 바깥 풍경만 기울어 보이게 함 (VR 멀미 방지 원칙)
  - 이중 시야(잔상) — `AfterimagePass` 포스트프로세싱 셰이더
  - 블러 — 캔버스에 CSS `filter: blur()`를 주기적으로 적용 (셰이더 불필요, 저비용)
  - 터널 비전(비네팅) — CSS `radial-gradient` 오버레이 (셰이더 불필요, 저비용)
  - `config.drunk.visual.lowSpecMode = true`로 설정하면 이중시야·블러를 끄고
    흔들림+비네팅만 남는 저사양 모드가 된다
  - 모든 효과는 `config.drunk.intensity`(0~1)에 비례해서 커지고 작아진다.
    **일반 모드에서는 intensity가 항상 0으로 취급되어 모든 음주 효과가 꺼진다.**
- **입력 디버그 오버레이** (`src/ui/inputDebugOverlay.js`, I 키): 원래 입력값(밝은 노란색)과
  지연 적용 후 값(파란색)을 채널별 막대그래프로 동시에 보여준다.

## 추가: 경찰서 출발 · 신호 교차로 · 보행자

- **출발 지점 경찰서** (`src/scene/policeStation.js`): 본관(흰 벽)·별관(회색 벽), 파란 띠,
  CanvasTexture 창문 텍스처, CanvasTexture 간판(문구는 config), 담장과 정문(기둥 표지판),
  태극기 게양대, 주차된 순찰차 2대(1개 InstancedMesh), 주차 구획선(InstancedMesh).
  차량은 주차장에서 정문을 바라보고 출발해서, 정문을 나와 우회전하면 도로에 합류한다.
  주차장 부지 안에서는 도로 이탈로 판정하지 않는다.
- **신호등 교차로** (`src/scene/intersection.js`, `src/traffic/trafficSignal.js`):
  교차 도로, 흰색 줄무늬 횡단보도(InstancedMesh, 도로면보다 1cm 위), 정지선, 보도 블록,
  신호등(기둥 + 도로 위 암 + 가로형 3구 등, 기둥 중간에 보조 신호등 1개 더).
  점등은 emissive 재질의 밝기만 바꿔서 표현하고, PointLight는 쓰지 않는다(옵션으로만 켤 수 있음).
  차 앞범퍼가 정지선에서 `triggerDistanceM` 안으로 들어오면 녹 → 황 → 적으로 바뀐다.
  적색일 때 앞범퍼가 정지선을 넘으면 **신호위반**으로 기록한다.
- **보행자** (`src/traffic/pedestrians.js`): 적색이 켜지면 각 보행자가 `delayAfterRedS`초 뒤에
  초속 1.3m로 횡단보도를 건넌다(운전자 오른쪽 → 왼쪽). 일반/음주 모드에서 똑같이 나온다.
  차가 거의 멈춰서 앞을 막고 있으면 보행자가 기다리고, 움직이는 차에 닿으면 **보행자 충돌**로
  기록한다. 이때 보행자를 장면에서 빼고, 붉은 화면 점멸과 경고음(WebAudio)만으로 알린다.
  사실적인 묘사는 없다. 점멸은 카메라에 붙인 반투명 판으로 그려서 VR에서도 보인다.
- **결과 비교 화면** (`src/ui/resultsScreen.js`): 일반/음주 모드별 신호위반·보행자 충돌·도로 이탈
  횟수와 완주 시간. 기록은 이벤트가 일어난 순간의 모드에 쌓이고, R을 누르면 현재 모드 기록만 초기화된다.
- **성능**: 반복 오브젝트(가로수·가로등·건물·횡단보도 줄무늬·주차선·순찰차)는 InstancedMesh로 그린다.
  정적인 부품은 버텍스 컬러로 칠해서 병합한다. 측정값은 PC에서 드로우콜 약 32~48회, 삼각형 약 1.5만 개다.
  교차로가 보이는 구간에서 보행자 스키닝 메시는 2개뿐이다.
  ※ 실제 안드로이드 폰 VR 모드의 60fps는 VR 기능(4단계)을 넣은 뒤 실기기로 확인해야 한다.

### 개발용 고정 시점

- `?view=station` — 경찰서 전경
- `?view=intersection` — 교차로 전경
- `?view=pedestrian` — 강제로 적색 전환 + 보행자가 건너는 중인 장면
- 개발 서버에서는 `window.__game`(physics, signal, pedestrians, recorder 등)으로 상태를 조작할 수 있다.

### 사용한 외부 에셋과 라이선스

| 에셋 | 출처 | 라이선스 | 사용 파일 |
| --- | --- | --- | --- |
| Mini Characters 1.0 (Kenney) | https://kenney.nl/assets/mini-characters | CC0 1.0 (퍼블릭 도메인) | `public/models/pedestrians/character-male-b.glb`, `character-female-c.glb`, `Textures/colormap.png` |

원본 라이선스 파일은 `public/models/pedestrians/License-Kenney.txt`에 함께 넣어두었다.
모델에 들어 있는 `idle`/`walk` 애니메이션을 쓴다. 모델을 불러오지 못하거나
`pedestrians.useGltf = false`이면 기본 도형 캐릭터(사인파 팔다리 애니메이션)로 자동 대체된다.

## 조정 가능한 수치 (`src/config.js`)

| 값 | 설명 |
| --- | --- |
| `vehicle.*` | 가속/제동/조향 물리 (1단계 참고) |
| `road.*` | 코스 길이/폭/이탈 페널티 (1단계 참고) |
| `cockpit.*` | 운전석 시점/핸들 회전 범위 (1단계 참고) |
| `drunk.intensity` | 음주 효과 전체 강도 (0~1). 모든 하위 효과에 비례 적용 |
| `drunk.inputDelay.throttleMs / brakeMs / steerMs` | 채널별 입력 지연 시간 (기본 300/600/400ms) |
| `drunk.steering.sensitivityFactor` | 조향 입력 대비 실제 반영 비율 (기본 0.7) |
| `drunk.steering.reactionTimeConstantS` | 조향 반응 둔화 정도 (클수록 느리게 따라감) |
| `drunk.steering.noiseAmplitude` 등 | 저주파 좌우 흔들림 노이즈 크기/주파수 |
| `drunk.steering.oversteerTriggerDelta` 등 | 과조향(오버슈트) 발동 민감도/크기/지속시간 |
| `drunk.brake.effectivenessFactor` | 브레이크 실제 반영 비율 (기본 0.8) |
| `drunk.visual.lowSpecMode` | true면 이중시야·블러를 끄고 흔들림+비네팅만 적용 |
| `drunk.visual.swayPeriodS / swayAmplitudeDeg` | 바깥 풍경 흔들림 주기/각도 |
| `drunk.visual.doubleVisionDamp` | 이중 시야(잔상) 강도 |
| `drunk.visual.blurPeriodS / blurMaxPixels` | 블러 주기/최대 강도 |
| `drunk.visual.vignetteMaxOpacity` | 터널 비전 최대 진하기 |
| `course.startX / startZ / startHeadingRad` | 출발 위치·방향 (경찰서 주차장) |
| `road.startZ` | 도로 시작 z (정문 합류 구간 확보용) |
| `vehicle.frontOffsetM / rearOffsetM / halfWidthM` | 정지선·충돌 판정용 차체 크기 |
| `policeStation.signText / gateSignText / annexSignText` | 간판 문구 |
| `policeStation.lot / wall / gate` | 주차장 영역, 담장, 정문 위치·폭 |
| `policeStation.mainBuilding / annex` | 본관·별관 위치·크기·층수 |
| `policeStation.flagpole / patrolCars / parkingSpaceCount` | 게양대, 순찰차 위치, 주차 구획 수 |
| `policeStation.wallColor / annexWallColor / bandColor` | 벽 색, 파란 띠 색 |
| `intersection.z` | 교차로 위치 (반드시 직선 구간) |
| `intersection.crosswalk.*`, `stopLine.*` | 횡단보도 줄무늬 크기, 높이, 정지선 위치 |
| `intersection.signal.triggerDistanceM` | 신호 전환이 시작되는 거리 |
| `intersection.signal.greenHoldS / yellowDurationS / redDurationS` | 신호 단계별 시간 |
| `intersection.signal.litEmissiveIntensity / usePointLight` | 점등 밝기 / PointLight 사용 여부 |
| `pedestrians.walkSpeedMps` | 보행 속도 (기본 1.3m/s) |
| `pedestrians.list[]` | 보행자별 모델, 출발 방향, 적색 후 출발 지연, 횡단보도 내 위치 |
| `pedestrians.useGltf / heightM / walkAnimTimeScale` | glTF 사용 여부, 키, 걷기 애니메이션 속도 |
| `collisionFeedback.*` | 점멸 색, 강도, 횟수, 경고음 주파수, 음량, 충돌 시 차량 정지 여부 |
| `debugViews.*` | 개발용 고정 시점 좌표 |

도로 커브 형태(위치·각도)는 `src/scene/road.js`의 `CURVE_SEGMENTS`에서 조정합니다.

## 테스트

각 단계마다 Playwright로 PC 크롬 화면을 열어 콘솔 에러와 렌더링을 확인합니다.
현재는 수동 스크립트로 확인했으며, 이후 단계에서 측정 모듈이 추가되면 `tests/` 폴더에
단위 테스트(입력 지연 버퍼 보간, 반응시간/정지거리 계산 등)를 구성할 예정입니다.

## 확인해주세요

1. `?mode=drunk`로 접속하거나 M 키를 눌러 음주 모드로 전환했을 때, 가속/브레이크/조향이
   눈에 띄게 늦게 반응하는지
2. 급하게 방향을 바꿀 때 핸들이 살짝 더 돌았다가 되돌아오는 과조향이 느껴지는지
3. 직선 구간에서도 핸들을 가만히 둬도 차가 미세하게 좌우로 흔들리는지
4. 바깥 풍경이 천천히 좌우로 기울어지는데, 대시보드/핸들/속도계는 화면에 고정되어
   있어 어지럽지 않은 수준인지 (너무 심하면 `swayAmplitudeDeg`를 낮춰주세요)
5. 이중 시야(잔상)와 블러가 과하지 않은지 (`doubleVisionDamp`, `blurMaxPixels` 조정 가능)
6. `drunk.visual.lowSpecMode = true`로 바꾸면 이중시야/블러가 꺼지고 흔들림+비네팅만
   남는지
7. I 키를 눌러 입력 디버그 오버레이를 켰을 때, 조향/브레이크를 조작하면 노란색(원래
   입력)이 먼저 움직이고 파란색(지연 후)이 뒤따라 움직이는지
8. M 키로 모드를 왔다갔다 전환해도 이상하게 튀거나 멈추지 않는지
9. 일반 모드에서는 1단계와 동일하게 어떤 음주 효과도 없는지 (회귀 확인)

문제 없으면 3단계(돌발 상황: 앞차 급정거·보행자, 측정 모듈, 시작 화면 → 일반 →
음주 → 결과 비교 전체 흐름)로 진행하겠습니다.
