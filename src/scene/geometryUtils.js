import * as THREE from "three";

// 여러 모듈(경찰서, 횡단보도, 앞차, 3D 패널)에서 함께 쓰는 작은 도형/텍스처 헬퍼.

export function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// 지오메트리 전체에 단색 버텍스 컬러를 입힌다 (여러 색 부품을 하나로 병합하기 위함).
export function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function makeCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
