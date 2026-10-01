import * as THREE from "three";

export function createSceneSetup(canvas, config) {
  const scene = new THREE.Scene();
  const skyColor = 0x8fc7e8;
  scene.background = new THREE.Color(skyColor);
  scene.fog = new THREE.Fog(skyColor, config.render.fogNearM, config.render.fogFarM);

  const camera = new THREE.PerspectiveCamera(
    config.render.fov,
    window.innerWidth / window.innerHeight,
    config.render.near,
    config.render.far
  );
  // 카메라는 main.js의 cameraRig(운전석 눈 위치, 180도 회전) 안에 넣는다.
  // 카메라 자신의 회전은 VR 머리 방향 전용으로 비워둔다.

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false; // 모바일 성능을 위해 그림자 비활성화

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  const hemi = new THREE.HemisphereLight(skyColor, 0x4a7c3f, 0.5);
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(80, 120, 40);
  scene.add(ambient, hemi, sun);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
}
