import * as THREE from "three";
import { StereoEffect } from "three/examples/jsm/effects/StereoEffect.js";

// 카드보드형 고글용 VR 표시 관리.
//  - "xr":     WebXR immersive-vr (브라우저/기기가 지원할 때). 머리 추적은 브라우저가 처리.
//  - "stereo": 화면을 좌우로 나눠 양안 렌더링 + 휴대폰 자이로(deviceorientation)로 고개 방향 추적.
//              WebXR 카드보드를 지원하지 않는 대부분의 안드로이드 크롬에서 이 방식이 쓰인다.
//  - "flat":   일반 화면 (PC 등).
// 카메라는 cameraRig(운전석 눈 위치) 안에 있으므로, 머리 회전은 카메라의 로컬 회전으로만 적용된다.
export function createVrManager(renderer, scene, camera, config) {
  const vrCfg = config.vr;
  let mode = "flat";
  let xrSupported = false;
  const stereo = new StereoEffect(renderer);
  stereo.setEyeSeparation(vrCfg.stereoEyeSeparationM);
  const listeners = [];
  let wakeLock = null;
  const flatPixelRatio = Math.min(window.devicePixelRatio, 2);

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");

  const ready = (async () => {
    try {
      xrSupported = !!(navigator.xr && (await navigator.xr.isSessionSupported("immersive-vr")));
    } catch {
      xrSupported = false;
    }
  })();

  // ── 자이로 → 카메라 회전 (구 DeviceOrientationControls와 같은 변환) ──
  const orient = { alpha: null, beta: 0, gamma: 0 };
  const onOrientation = (e) => {
    if (e.alpha == null) return;
    orient.alpha = e.alpha;
    orient.beta = e.beta;
    orient.gamma = e.gamma;
  };
  const zee = new THREE.Vector3(0, 0, 1);
  const euler = new THREE.Euler();
  const q0 = new THREE.Quaternion();
  const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // X축 -90°
  const deviceQ = new THREE.Quaternion();
  const yawOffset = new THREE.Quaternion();
  let needRecenter = true;

  function deviceQuaternion(out) {
    const deg = THREE.MathUtils.DEG2RAD;
    const screenAngle = (screen.orientation?.angle ?? window.orientation ?? 0) * deg;
    euler.set(orient.beta * deg, orient.alpha * deg, -orient.gamma * deg, "YXZ");
    out.setFromEuler(euler);
    out.multiply(q1);
    out.multiply(q0.setFromAxisAngle(zee, -screenAngle));
    return out;
  }

  function updateHead() {
    if (mode !== "stereo" || orient.alpha == null) return;
    deviceQuaternion(deviceQ);
    if (needRecenter) {
      // 현재 바라보는 좌우 방향(yaw)을 정면으로 삼는다
      const e = new THREE.Euler().setFromQuaternion(deviceQ, "YXZ");
      yawOffset.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
      needRecenter = false;
    }
    camera.quaternion.copy(yawOffset).multiply(deviceQ);
  }

  async function enterStereo() {
    // iOS는 권한 요청이 필요 (안드로이드는 바로 동작)
    if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
      try {
        await DeviceOrientationEvent.requestPermission();
      } catch {
        /* 거부되면 고개 추적 없이 진행 */
      }
    }
    window.addEventListener("deviceorientation", onOrientation);
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
      await screen.orientation?.lock?.("landscape");
    } catch {
      /* PC 등에서는 실패해도 무시 */
    }
    renderer.setPixelRatio(vrCfg.pixelRatio);
    stereo.setSize(window.innerWidth, window.innerHeight);
    camera.fov = vrCfg.stereoFovDeg;
    camera.updateProjectionMatrix();
    needRecenter = true;
    setMode("stereo");
  }

  async function enterXR() {
    const session = await navigator.xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] });
    renderer.xr.setFramebufferScaleFactor(vrCfg.pixelRatio);
    await renderer.xr.setSession(session);
    session.addEventListener("end", () => {
      camera.quaternion.identity();
      camera.position.set(0, 0, 0);
      setMode("flat");
    });
    setMode("xr");
  }

  async function enter() {
    await ready;
    try {
      wakeLock = await navigator.wakeLock?.request("screen"); // 주행 중 화면 꺼짐 방지
    } catch {
      wakeLock = null;
    }
    if (vrCfg.preferWebXR && xrSupported) {
      try {
        await enterXR();
        return;
      } catch (err) {
        console.warn("[vr] WebXR 시작 실패 → 화면 분할 방식으로 대체", err);
      }
    }
    await enterStereo();
  }

  async function exit() {
    if (mode === "xr") {
      await renderer.xr.getSession()?.end();
    } else if (mode === "stereo") {
      window.removeEventListener("deviceorientation", onOrientation);
      orient.alpha = null;
      camera.quaternion.identity();
      camera.fov = config.render.fov;
      camera.updateProjectionMatrix();
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* 무시 */
      }
      renderer.setPixelRatio(flatPixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      setMode("flat");
    }
    wakeLock?.release?.();
    wakeLock = null;
  }

  function setMode(m) {
    mode = m;
    listeners.forEach((fn) => fn(m));
  }

  window.addEventListener("resize", () => {
    if (mode === "stereo") stereo.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    ready,
    get mode() {
      return mode;
    },
    get xrSupported() {
      return xrSupported;
    },
    get isVr() {
      return mode !== "flat";
    },
    onModeChange(fn) {
      listeners.push(fn);
    },
    enter,
    exit,
    toggle() {
      return mode === "flat" ? enter() : exit();
    },
    recenter() {
      needRecenter = true;
    },
    updateHead,
    // 화면 분할 모드에서만 직접 그린다. 그 외(flat/xr)는 false를 돌려 호출자가 렌더링한다.
    renderStereo() {
      if (mode !== "stereo") return false;
      stereo.render(scene, camera);
      return true;
    },
  };
}
