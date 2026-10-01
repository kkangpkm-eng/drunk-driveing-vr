import * as THREE from "three";
import { config } from "./config.js";
import { createSceneSetup } from "./scene/sceneSetup.js";
import { createRoad, roadCenterX, roadHeadingAt } from "./scene/road.js";
import { createEnvironment } from "./scene/environment.js";
import { createCarInterior } from "./scene/carInterior.js";
import { createPoliceStation } from "./scene/policeStation.js";
import { createCrosswalks } from "./scene/intersection.js";
import { VehiclePhysics } from "./vehicle/vehiclePhysics.js";
import { DrunkSteeringProcessor, applyBrakeWeakening } from "./vehicle/drunkControl.js";
import { InputManager } from "./input/inputManager.js";
import { InputDelayBuffer } from "./input/inputDelayBuffer.js";
import { TrafficSignalController } from "./traffic/trafficSignal.js";
import { PedestrianManager } from "./traffic/pedestrians.js";
import { LeadCar } from "./traffic/leadCar.js";
import { RunMetrics } from "./measurement/runMetrics.js";
import { createHud } from "./ui/hud.js";
import { createInputDebugOverlay } from "./ui/inputDebugOverlay.js";
import { createMenus } from "./ui/menus.js";
import { createStartOverlay } from "./ui/startOverlay.js";
import { createDrunkPostProcessing } from "./effects/drunkPostProcessing.js";
import { getSwayRollRad } from "./effects/drunkSway.js";
import { createCollisionFeedback } from "./effects/collisionFeedback.js";
import { createVrVignette } from "./effects/vrVignette.js";
import { createVrManager } from "./vr/vrManager.js";

const MODE_LABEL = { normal: "일반 모드", drunk: "음주 모드" };
const otherMode = (m) => (m === "normal" ? "drunk" : "normal");

// ── 장면 ──────────────────────────────────────────────────────
const canvas = document.getElementById("game-canvas");
const { scene, camera, renderer } = createSceneSetup(canvas, config);

scene.add(createRoad(config));
scene.add(createEnvironment(config));
scene.add(createPoliceStation(config));
const crosswalks = createCrosswalks(config);
scene.add(crosswalks.group);

// 차량 그룹: 물리 결과(위치/헤딩)를 매 프레임 반영하는 컨테이너.
// 카메라 리그(운전석 눈 위치)와 운전석 내부, 3D 메뉴 패널을 자식으로 두어 함께 이동한다.
// 음주 모드의 화면 흔들림도 이 그룹 전체에 적용해서, 카메라와 실내가
// 항상 같은 상대 위치를 유지하도록 한다 (VR 멀미 방지: 머리 시점 자체는 안 흔들림).
const carGroup = new THREE.Group();
// 카메라 리그: 차량 전방이 +Z라서 기본(-Z를 바라봄) 카메라를 180도 돌려 둔다.
// 카메라 자신의 회전/위치는 VR 머리 추적(WebXR/자이로) 전용이다.
const cameraRig = new THREE.Group();
cameraRig.position.set(0, config.cockpit.eyeHeightM, config.cockpit.eyeForwardOffsetM);
cameraRig.rotation.y = Math.PI;
cameraRig.add(camera);
carGroup.add(cameraRig);

const interior = createCarInterior(config);
carGroup.add(interior.group);
scene.add(carGroup);

// ── 시스템 ────────────────────────────────────────────────────
const physics = new VehiclePhysics(config);
const inputManager = new InputManager(config);
const delayBuffer = new InputDelayBuffer();
const drunkSteering = new DrunkSteeringProcessor();
const hud = createHud(config.road.totalLengthM);
const debugOverlay = createInputDebugOverlay();
const postFx = createDrunkPostProcessing(renderer, scene, camera);
window.addEventListener("resize", () => postFx.setSize(window.innerWidth, window.innerHeight));

const signals = crosswalks.items.map((it) => new TrafficSignalController(it.layout, it.setSignalState));
const pedestrians = new PedestrianManager(scene, config, crosswalks.items.map((it) => it.layout));
const leadCar = new LeadCar(scene, config);
const collisionFx = createCollisionFeedback(camera, config.collisionFeedback);
const vrVignette = createVrVignette(camera, config.vr);
const menus = createMenus(carGroup, config);
const vr = createVrManager(renderer, scene, camera, config);
const metrics = new RunMetrics(config.measurement);
// 모드별로 마지막으로 완주한 주행의 측정 요약
const results = { normal: null, drunk: null };

// ── 게임 상태 ─────────────────────────────────────────────────
// title → select → driving ⇄ paused → results → (select | driving | title)
let gameState = "title";
let mode = "normal";
let menuIndex = 0;
let menuOptions = []; // [{ label, act }]
let elapsedTime = 0;
let debugVisible = false;
let lastPadText = "";
let carState = snapshot();

function snapshot() {
  return {
    x: physics.x,
    z: physics.z,
    heading: physics.heading,
    speedMps: physics.speedMps,
    speedKmh: physics.speedMps * 3.6,
    offRoad: physics.offRoad,
  };
}

const frontZOf = (s) => s.z + Math.cos(s.heading) * config.vehicle.frontOffsetM;

// ── 이벤트 → 측정/알림 ──
for (const s of signals) {
  // 황색이 켜진 순간 정지선 앞에서 달리고 있었다면 브레이크 반응 시간을 잰다
  s.on("yellow", () => {
    if (gameState !== "driving") return;
    if (frontZOf(carState) < s.stopLineZ && carState.speedMps > 2) metrics.startReaction(`signal-${s.index}`, s.stopLineZ);
  });
  s.on("red", () => pedestrians.onRed(s.index));
  s.on("violation", () => {
    if (gameState !== "driving") return;
    metrics.addSignalViolation();
    menus.showToast("신호위반!");
  });
}
leadCar.on("brake", ({ gapM }) => {
  if (gameState !== "driving" || gapM > 70) return; // 너무 멀리 떨어져 있으면 측정하지 않음
  metrics.startReaction("leadBrake");
  metrics.startStoppingDistance(physics.z);
});

// ── 화면 전환 ─────────────────────────────────────────────────
function resetWorld() {
  physics.reset();
  delayBuffer.reset();
  drunkSteering.reset();
  signals.forEach((s) => s.reset());
  pedestrians.reset();
  leadCar.reset();
  collisionFx.reset();
  metrics.reset();
  menus.hideToast();
  carState = snapshot();
}

function setMenu(state, options = [], index = 0) {
  gameState = state;
  menuOptions = options;
  menuIndex = index;
  if (state !== "driving") menus.hideToast(); // 메뉴 패널 뒤로 알림이 비치지 않게
  drawMenu();
}

function drawMenu() {
  const labels = menuOptions.map((o) => o.label);
  if (gameState === "title") menus.showTitle(inputManager.getStatusText());
  else if (gameState === "select") menus.showModeSelect(menuIndex, results);
  else if (gameState === "paused") menus.showPause(menuIndex, labels);
  else if (gameState === "results") menus.showResults(results, menuIndex, labels);
  else menus.hide();
}

function goTitle() {
  resetWorld();
  setMenu("title", [{ label: "시작하기", act: goSelect }]);
}

function goSelect() {
  resetWorld();
  const index = results.normal && !results.drunk ? 1 : 0;
  setMenu(
    "select",
    [
      { label: MODE_LABEL.normal, act: () => startRun("normal") },
      { label: MODE_LABEL.drunk, act: () => startRun("drunk") },
    ],
    index
  );
}

function startRun(m) {
  mode = m;
  resetWorld();
  setMenu("driving");
  vr.recenter();
  menus.showToast(`${MODE_LABEL[m]} · 정문을 나가 우회전하세요`, "rgba(30,80,170,0.92)");
}

function pauseRun() {
  setMenu("paused", [
    { label: "계속하기", act: () => setMenu("driving") },
    { label: "처음부터 다시 주행", act: () => startRun(mode) },
    { label: "모드 선택으로", act: goSelect },
  ]);
}

function showResults(finished) {
  if (finished) metrics.finish();
  results[mode] = metrics.summary();
  const other = otherMode(mode);
  const options = [];
  if (!results[other]) options.push({ label: `${MODE_LABEL[other]} 주행`, act: () => startRun(other) });
  options.push({ label: "다시 주행", act: () => startRun(mode) });
  options.push({ label: "모드 선택", act: goSelect });
  options.push({ label: "처음으로", act: goTitle });
  setMenu("results", options, 0);
}

// ── 입력 → 화면 동작 ─────────────────────────────────────────────
function handleActions(startOverlay) {
  const has = (a) => inputManager.has(a);

  if (startOverlay?.open) {
    // 휴대폰에서는 패드 인식을 위해 버튼을 누르게 되므로, 패드 입력으로는 화면 모드를 시작하지 않는다
    // (VR은 반드시 화면 터치로 시작). 키보드 Enter만 "화면 모드로 시작".
    if (inputManager.keyActions.has("confirm")) startOverlay.confirmFlat();
    return;
  }
  if (has("toggleVr")) vr.toggle();
  if (has("recenter")) vr.recenter();
  if (has("debug")) {
    debugVisible = !debugVisible;
    debugOverlay.setVisible(debugVisible);
  }

  if (gameState === "driving") {
    if (has("pause")) pauseRun();
    else if (has("restart")) startRun(mode);
    else if (has("toggleMode")) startRun(otherMode(mode)); // 개발용: 다른 모드로 처음부터
    else if (has("showResults")) showResults(false); // 개발용: 완주 전 결과 화면
    return;
  }
  if (!menuOptions.length) return;

  const prev = menuIndex;
  const n = menuOptions.length;
  if (has("up") || has("left")) menuIndex = (menuIndex - 1 + n) % n;
  if (has("down") || has("right")) menuIndex = (menuIndex + 1) % n;
  if (menuIndex !== prev) drawMenu();

  if (has("confirm")) {
    menuOptions[menuIndex].act();
  } else if (has("back") || (gameState === "paused" && has("pause"))) {
    if (gameState === "select") goTitle();
    else if (gameState === "paused") setMenu("driving");
  }
}

// ── 매 프레임 ─────────────────────────────────────────────────
const qHeading = new THREE.Quaternion();
const qSway = new THREE.Quaternion();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const timer = new THREE.Timer();
let startOverlay = null;
let padCheckTimer = 0;

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // 탭 전환 등으로 인한 큰 dt 방지
  elapsedTime += dt;
  const nowMs = elapsedTime * 1000;

  const rawInput = inputManager.update(dt);
  handleActions(startOverlay);

  // 컨트롤러 연결 상태가 바뀌면 시작 화면 안내 문구 갱신
  padCheckTimer -= dt;
  if (gameState === "title" && padCheckTimer <= 0) {
    padCheckTimer = 1;
    const t = inputManager.getStatusText();
    if (t !== lastPadText) {
      lastPadText = t;
      drawMenu();
    }
  }

  const driving = gameState === "driving";
  const intensity = driving && mode === "drunk" ? config.drunk.intensity : 0;
  let effectiveSteer = 0;
  let delayedInput = { throttle: 0, brake: 0, steer: 0 };

  if (driving) {
    const delayCfg = config.drunk.inputDelay;
    // ── 입력 지연 버퍼: 원래 입력을 저장하고, 채널별로 지연된 값을 꺼낸다 ──
    delayBuffer.push(nowMs, rawInput);
    delayedInput = {
      throttle: delayBuffer.getDelayed("throttle", delayCfg.throttleMs * intensity, nowMs),
      brake: delayBuffer.getDelayed("brake", delayCfg.brakeMs * intensity, nowMs),
      steer: delayBuffer.getDelayed("steer", delayCfg.steerMs * intensity, nowMs),
    };
    // ── 지연된 입력 위에 조향/브레이크 부정확성을 덧씌운다 ──
    effectiveSteer = drunkSteering.process(delayedInput.steer, dt, elapsedTime, config.drunk.steering, intensity);
    const effectiveBrake = applyBrakeWeakening(delayedInput.brake, config.drunk.brake, intensity);
    carState = physics.update({ throttle: delayedInput.throttle, brake: effectiveBrake, steer: effectiveSteer }, dt);

    const frontZ = frontZOf(carState);
    for (const s of signals) s.update(dt, frontZ);

    // ── 앞차 ──
    const rear = leadCar.update(dt, carState, signals);
    if (rear) {
      // 앞차를 뚫고 지나가지 않도록 뒤로 밀고 속도를 앞차에 맞춘다
      physics.z -= rear.overlapM;
      physics.speedMps = Math.min(physics.speedMps, rear.leadSpeedMps);
      if (rear.newHit) {
        metrics.addRearEndCollision();
        collisionFx.trigger();
        menus.showToast("앞차 추돌!");
      }
      carState = snapshot();
    }
  }

  // ── 보행자 (메뉴 화면에서도 걷는 모습은 보이되 충돌 판정은 주행 중에만) ──
  const hits = pedestrians.update(dt, gameState === "viewer" ? null : carState, driving);
  if (hits > 0) {
    metrics.addPedestrianCollision(hits);
    collisionFx.trigger();
    menus.showToast("보행자 충돌!");
    if (config.collisionFeedback.stopVehicle) physics.speedMps = 0;
  }

  if (driving) {
    metrics.update({
      dt,
      rawBrake: rawInput.brake,
      speedMps: physics.speedMps,
      z: physics.z,
      frontZ: frontZOf(carState),
      offRoad: carState.offRoad,
    });
    if (carState.z >= config.road.totalLengthM) showResults(true);
  }

  // ── 차량 그룹 배치: 위치/헤딩 + (음주모드) 바깥 풍경 흔들림 ──
  const swayRoll = getSwayRollRad(elapsedTime, config.drunk.visual, intensity);
  qHeading.setFromAxisAngle(AXIS_Y, carState.heading);
  qSway.setFromAxisAngle(AXIS_Z, swayRoll);
  carGroup.quaternion.copy(qHeading).multiply(qSway);
  carGroup.position.set(carState.x, 0, carState.z);
  if (driving && carState.offRoad) {
    carGroup.position.y = Math.sin(elapsedTime * 45) * config.road.offRoadShakeAmplitude;
  }

  // 핸들 시각화는 실제로 차량에 반영된 값(지연+왜곡 후)을 따라가야
  // "입력보다 늦게/부정확하게 돌아가는" 느낌이 전달된다.
  interior.setSteerAngle(effectiveSteer * config.cockpit.steeringWheelMaxAngleRad);
  interior.setSpeedKmh(physics.speedMps * 3.6);

  hud.setVisible(driving && !vr.isVr);
  hud.update({ speedKmh: physics.speedMps * 3.6, progressZ: carState.z, modeLabel: MODE_LABEL[mode] });
  debugOverlay.update(rawInput, delayedInput);

  menus.update(dt);
  collisionFx.update(dt);
  const vis = config.drunk.visual;
  postFx.update(dt, intensity, vis, vr.mode, config.vr);
  vrVignette.setOpacity(vr.isVr && vis.vignetteEnabled ? Math.min(1, intensity) * vis.vignetteMaxOpacity : 0);

  vr.updateHead();
  if (!vr.renderStereo()) postFx.render();
}

// ── 시작 ──────────────────────────────────────────────────────
// 개발용 URL 파라미터:
//   ?mode=normal|drunk  → 첫 화면/메뉴 없이 바로 해당 모드로 주행
//   ?view=station|intersection|pedestrian → 고정 시점에서 장면 확인
const params = new URLSearchParams(location.search);
const urlMode = params.get("mode");
const viewName = params.get("view");

if (viewName && config.debugViews[viewName]) {
  applyDebugView(viewName);
} else if (urlMode === "normal" || urlMode === "drunk") {
  startRun(urlMode);
} else {
  goTitle();
  startOverlay = createStartOverlay({
    onFlat: () => {},
    onVr: () => vr.enter(),
    getGamepadText: () => inputManager.getStatusText(),
  });
}

renderer.setAnimationLoop(animate);

function applyDebugView(name) {
  const views = config.debugViews;
  const view = views[name];
  gameState = "viewer";
  menus.hide();
  cameraRig.remove(camera);
  scene.add(camera);
  // intersection/pedestrian 시점은 viewCrosswalkIndex 번째 횡단보도 기준 상대 좌표
  let ox = 0;
  let oz = 0;
  const cw = params.has("cw") ? Number(params.get("cw")) : views.viewCrosswalkIndex;
  if (name !== "station") {
    const L = crosswalks.items[cw].layout;
    ox = L.cx;
    oz = L.z;
  }
  camera.position.set(view.position[0] + ox, view.position[1], view.position[2] + oz);
  camera.lookAt(view.lookAt[0] + ox, view.lookAt[1], view.lookAt[2] + oz);
  if (name === "pedestrian") {
    signals[cw].forceRed();
    pedestrians.ready.then(() => pedestrians.skipAhead(4.5));
  }
}

if (import.meta.env.DEV) {
  window.__game = {
    physics,
    signals,
    pedestrians,
    leadCar,
    metrics,
    results,
    renderer,
    config,
    vr,
    startRun,
    roadCenterX,
    roadHeadingAt,
    get state() {
      return gameState;
    },
  };
}
