import * as THREE from "three";

// VR용 터널 비전. CSS 오버레이는 WebXR 화면에 나오지 않고, 화면 분할 방식에서는 양쪽 눈에
// 맞지 않으므로, 카메라에 붙인 큰 판에 "가운데가 뚫린" 방사형 그라데이션을 그려 각 눈에 올바르게 보이게 한다.
// 판이 시야보다 훨씬 커서 가장자리가 보이지 않는다.
export function createVrVignette(camera, vrCfg) {
  const dist = 0.3;
  const size = 3.0; // 판 한 변 (m) — 거리 0.3m에서 약 ±79°를 덮음
  const half = size / 2;
  const toUv = (deg) => (Math.tan(THREE.MathUtils.degToRad(deg)) * dist) / half; // 판 중심 기준 0~1

  const res = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = res;
  const g = canvas.getContext("2d");
  const inner = Math.min(0.99, toUv(vrCfg.vignetteInnerDeg)) * (res / 2);
  const outer = Math.min(1, toUv(vrCfg.vignetteOuterDeg)) * (res / 2);
  const grad = g.createRadialGradient(res / 2, res / 2, inner, res / 2, res / 2, outer);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,1)");
  g.fillStyle = grad;
  g.fillRect(0, 0, res, res);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.position.set(0, 0, -dist);
  mesh.renderOrder = 800;
  mesh.frustumCulled = false;
  mesh.visible = false;
  camera.add(mesh);

  return {
    setOpacity(o) {
      mat.opacity = o;
      mesh.visible = o > 0.01;
    },
  };
}
