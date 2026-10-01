import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// 이중 시야(잔상)는 실제 포스트프로세싱 셰이더(AfterimagePass)가 필요하지만,
// 블러/비네팅은 CSS(캔버스 filter, 오버레이 div)만으로 충분히 저렴하게 구현할 수 있어
// 별도 셰이더 패스 없이 처리한다. 저사양 모드에서는 이중시야/블러를 끄고
// 흔들림(drunkSway)과 비네팅만 남긴다.
export function createDrunkPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const afterimagePass = new AfterimagePass(0);
  afterimagePass.enabled = false;
  composer.addPass(afterimagePass);
  composer.addPass(new OutputPass());

  const canvas = renderer.domElement;

  const vignetteEl = document.createElement("div");
  vignetteEl.style.cssText = `
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.9) 100%);
    opacity: 0;
  `;
  document.getElementById("app").appendChild(vignetteEl);

  let elapsed = 0;

  function update(dt, intensity, visualCfg) {
    elapsed += dt;
    const lowSpec = visualCfg.lowSpecMode;

    const doubleVisionOn = visualCfg.doubleVisionEnabled && !lowSpec && intensity > 0.01;
    afterimagePass.enabled = doubleVisionOn;
    if (doubleVisionOn) {
      afterimagePass.damp = visualCfg.doubleVisionDamp * intensity;
    }

    if (visualCfg.blurEnabled && !lowSpec && intensity > 0.01) {
      const phase = Math.sin((elapsed / visualCfg.blurPeriodS) * Math.PI * 2) * 0.5 + 0.5;
      const blurPx = phase * visualCfg.blurMaxPixels * intensity;
      canvas.style.filter = blurPx > 0.02 ? `blur(${blurPx.toFixed(2)}px)` : "";
    } else {
      canvas.style.filter = "";
    }

    if (visualCfg.vignetteEnabled && intensity > 0.01) {
      vignetteEl.style.opacity = String(Math.min(1, intensity) * visualCfg.vignetteMaxOpacity);
    } else {
      vignetteEl.style.opacity = "0";
    }
  }

  function render() {
    // 잔상 효과가 꺼져 있으면 컴포저(추가 렌더타겟)를 거치지 않고 바로 그려 비용을 아낀다.
    if (afterimagePass.enabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  function setSize(w, h) {
    composer.setSize(w, h);
  }

  return { update, render, setSize };
}
