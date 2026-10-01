import * as THREE from "three";
import { makeCanvasTexture } from "../scene/geometryUtils.js";

export const UI_FONT = `"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif`;

// CanvasTexture를 붙인 평면 패널. VR(WebXR/화면 분할)에서도 보이도록 HTML이 아니라 장면 안에 그린다.
// 항상 다른 물체 위에 보이도록 depthTest를 끄고 renderOrder를 높게 둔다.
export function createPanel3D(widthM, heightM, pxPerM = 600) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(widthM * pxPerM);
  canvas.height = Math.round(heightM * pxPerM);
  const ctx = canvas.getContext("2d");
  const tex = makeCanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(widthM, heightM), mat);
  mesh.renderOrder = 900;
  mesh.frustumCulled = false;
  mesh.visible = false;

  return {
    mesh,
    canvas,
    // draw(ctx, w, h) 콜백으로 캔버스를 다시 그리고 텍스처를 갱신한다.
    draw(fn) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fn(ctx, canvas.width, canvas.height);
      tex.needsUpdate = true;
    },
    setVisible(v) {
      mesh.visible = v;
    },
    setOpacity(o) {
      mat.opacity = o;
    },
  };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function font(px, weight = 600) {
  return `${weight} ${Math.round(px)}px ${UI_FONT}`;
}
