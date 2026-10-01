import * as THREE from "three";
import { config } from "./config.js";
import { createSceneSetup } from "./scene/sceneSetup.js";
import { createRoad } from "./scene/road.js";
import { createEnvironment } from "./scene/environment.js";
import { createCarInterior } from "./scene/carInterior.js";
import { VehiclePhysics } from "./vehicle/vehiclePhysics.js";
import { DrunkSteeringProcessor, applyBrakeWeakening } from "./vehicle/drunkControl.js";
import { InputManager } from "./input/inputManager.js";
import { InputDelayBuffer } from "./input/inputDelayBuffer.js";
import { createHud } from "./ui/hud.js";
import { createInputDebugOverlay } from "./ui/inputDebugOverlay.js";
import { createDrunkPostProcessing } from "./effects/drunkPostProcessing.js";
import { getSwayRollRad } from "./effects/drunkSway.js";
import { createPoliceStation } from "./scene/policeStation.js";
import { createIntersection } from "./scene/intersection.js";
import { TrafficSignalController } from "./traffic/trafficSignal.js";
import { PedestrianManager } from "./traffic/pedestrians.js";
import { createCollisionFeedback } from "./effects/collisionFeedback.js";
import { createRunRecorder, createResultsScreen } from "./ui/resultsScreen.js";

const canvas = document.getElementById("game-canvas");
const { scene, camera, renderer } = createSceneSetup(canvas, config);

scene.add(createRoad(config));
scene.add(createEnvironment(config));
scene.add(createPoliceStation(config));

const intersection = createIntersection(config);
scene.add(intersection.group);

// 차량 그룹: 물리 결과(위치/헤딩)를 매 프레임 반영하는 컨테이너.
// 카메라와 운전석 내부(대시보드/핸들/속도계)를 자식으로 두어 함께 이동한다.
// 음주 모드의 화면 흔들림도 이 그룹 전체에 적용해서, 카메라와 실내가
// 항상 같은 상대 위치를 유지하도록 한다 (VR 멀미 방지: 머리 시점 자체는 안 흔들림).
const carGroup = new THREE.Group();
camera.position.set(0, config.cockpit.eyeHeightM, config.cockpit.eyeForwardOffsetM);
carGroup.add(camera);

const interior = createCarInterior(config);
carGroup.add(interior.group);

scene.add(carGroup);

const physics = new VehiclePhysics(config);
const inputManager = new InputManager();
const delayBuffer = new InputDelayBuffer();
const drunkSteering = new DrunkSteeringProcessor();
const hud = createHud(config.road.totalLengthM);
const debugOverlay = createInputDebugOverlay();
const postFx = createDrunkPostProcessing(renderer, scene, camera);
window.addEventListener("resize", () => postFx.setSize(window.innerWidth, window.innerHeight));

// ── 교차로 신호 / 보행자 / 충돌 피드백 / 결과 기록 ──
const signal = new TrafficSignalController(config, intersection.layout, intersection.setSignalState);
const pedestrians = new PedestrianManager(scene, config, intersection.layout);
const collisionFx = createCollisionFeedback(camera, config.collisionFeedback);
const recorder = createRunRecorder();
const resultsScreen = createResultsScreen(recorder);
let runTimeS = 0;
let finished = false;
let wasOffRoad = false;

signal.on("red", () => pedestrians.onRed());
signal.on("violation", () => {
  recorder.add(mode, "signalViolations");
  hud.showToast("신호위반");
});

// URL 파라미터로 개발 중 원하는 모드부터 바로 시작할 수 있게 한다 (?mode=drunk)
const urlMode = new URLSearchParams(location.search).get("mode");
let mode = urlMode === "drunk" ? "drunk" : "normal";
let debugVisible = false;

const heldKeys = { restart: false, mode: false, debug: false, results: false };
let elapsedTime = 0;

const qHeading = new THREE.Quaternion();
const qSway = new THREE.Quaternion();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

const timer = new THREE.Timer();

function handleEdgeKey(code, heldFlagKey, onPress) {
  const isDown = inputManager.isKeyDown(code);
  if (isDown && !heldKeys[heldFlagKey]) onPress();
  heldKeys[heldFlagKey] = isDown;
}

function animate() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05); // 탭 전환 등으로 인한 큰 dt 방지
  elapsedTime += dt;
  const nowMs = elapsedTime * 1000;

  const rawInput = inputManager.update(dt);

  handleEdgeKey("KeyR", "restart", () => {
    physics.reset();
    delayBuffer.reset();
    drunkSteering.reset();
    signal.reset();
    pedestrians.reset();
    collisionFx.reset();
    recorder.resetMode(mode);
    resultsScreen.hide();
    runTimeS = 0;
    finished = false;
    wasOffRoad = false;
  });
  handleEdgeKey("KeyM", "mode", () => {
    mode = mode === "normal" ? "drunk" : "normal";
  });
  handleEdgeKey("KeyI", "debug", () => {
    debugVisible = !debugVisible;
    debugOverlay.setVisible(debugVisible);
  });
  handleEdgeKey("KeyT", "results", () => resultsScreen.toggle());

  const intensity = mode === "drunk" ? config.drunk.intensity : 0;
  const delayCfg = config.drunk.inputDelay;

  // ── 입력 지연 버퍼: 원래 입력을 저장하고, 채널별로 지연된 값을 꺼낸다 ──
  delayBuffer.push(nowMs, rawInput);
  const delayedInput = {
    throttle: delayBuffer.getDelayed("throttle", delayCfg.throttleMs * intensity, nowMs),
    brake: delayBuffer.getDelayed("brake", delayCfg.brakeMs * intensity, nowMs),
    steer: delayBuffer.getDelayed("steer", delayCfg.steerMs * intensity, nowMs),
  };

  // ── 지연된 입력 위에 조향/브레이크 부정확성을 덧씌운다 ──
  const effectiveSteer = drunkSteering.process(
    delayedInput.steer,
    dt,
    elapsedTime,
    config.drunk.steering,
    intensity
  );
  const effectiveBrake = applyBrakeWeakening(delayedInput.brake, config.drunk.brake, intensity);
  const effectiveInput = { throttle: delayedInput.throttle, brake: effectiveBrake, steer: effectiveSteer };

  const state = physics.update(effectiveInput, dt);
  runTimeS += dt;

  // ── 교차로: 신호 전환/신호위반 판정은 차량 앞범퍼 기준 ──
  const frontZ = state.z + Math.cos(state.heading) * config.vehicle.frontOffsetM;
  signal.update(dt, frontZ);

  const hits = pedestrians.update(dt, state);
  if (hits > 0) {
    recorder.add(mode, "pedestrianCollisions", hits);
    collisionFx.trigger();
    hud.showToast("보행자 충돌");
    if (config.collisionFeedback.stopVehicle) physics.speedMps = 0;
  }
  collisionFx.update(dt);

  if (state.offRoad && !wasOffRoad) recorder.add(mode, "laneDepartures");
  wasOffRoad = state.offRoad;

  if (!finished && state.z >= config.road.totalLengthM) {
    finished = true;
    recorder.finish(mode, runTimeS);
    resultsScreen.show();
  }

  // ── 차량 그룹 배치: 위치/헤딩 + (음주모드) 바깥 풍경 흔들림 ──
  const swayRoll = getSwayRollRad(elapsedTime, config.drunk.visual, intensity);
  qHeading.setFromAxisAngle(AXIS_Y, state.heading);
  qSway.setFromAxisAngle(AXIS_Z, swayRoll);
  carGroup.quaternion.copy(qHeading).multiply(qSway);

  carGroup.position.set(state.x, 0, state.z);
  if (state.offRoad) {
    const shake = config.road.offRoadShakeAmplitude;
    carGroup.position.y = Math.sin(elapsedTime * 45) * shake;
  }

  // 핸들 시각화는 실제로 차량에 반영된 값(지연+왜곡 후)을 따라가야
  // "입력보다 늦게/부정확하게 돌아가는" 느낌이 전달된다.
  interior.setSteerAngle(effectiveSteer * config.cockpit.steeringWheelMaxAngleRad);
  interior.setSpeedKmh(state.speedKmh);

  hud.update({
    speedKmh: state.speedKmh,
    progressZ: state.z,
    modeLabel: mode === "drunk" ? "음주 모드" : "일반 모드",
  });
  debugOverlay.update(rawInput, delayedInput);

  postFx.update(dt, intensity, config.drunk.visual);
  postFx.render();
  requestAnimationFrame(animate);
}

applyDebugView();
animate();

// ── 개발용: ?view=station|intersection|pedestrian 으로 고정 시점에서 장면 확인 ──
function applyDebugView() {
  const viewName = new URLSearchParams(location.search).get("view");
  const view = viewName && config.debugViews[viewName];
  if (!view) return;
  carGroup.remove(camera);
  scene.add(camera);
  camera.position.set(...view.position);
  camera.lookAt(...view.lookAt);
  if (viewName === "pedestrian") {
    signal.forceRed();
    pedestrians.ready.then(() => pedestrians.skipAhead(4.5));
  }
}

if (import.meta.env.DEV) {
  window.__game = { physics, signal, pedestrians, recorder, resultsScreen, config, renderer };
}
