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
  // 차량 좌표계에서 전방을 +Z로 두기로 했으므로, 기본값(-Z를 바라봄)인
  // 카메라를 180도 돌려 자동차가 나아가는 방향을 보게 만든다.
  camera.rotation.y = Math.PI;

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
