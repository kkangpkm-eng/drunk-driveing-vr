// 바깥 풍경의 느린 좌우 흔들림·기울어짐.
// 카메라 자체가 아니라 차량 그룹 전체(카메라+실내)를 함께 굴려서,
// 실내(대시보드/핸들)는 화면상 고정된 채로 바깥 풍경만 기울어 보이게 한다.
// (VR 멀미 방지 원칙: 머리 시점 자체를 흔들지 않는다)
export function getSwayRollRad(elapsedS, visualCfg, intensity) {
  if (!visualCfg.swayEnabled || intensity <= 0) return 0;
  const periodS = Math.max(0.5, visualCfg.swayPeriodS);
  const amplitudeRad = (visualCfg.swayAmplitudeDeg * Math.PI) / 180;
  const angle = Math.sin((elapsedS / periodS) * Math.PI * 2) * amplitudeRad * intensity;
  return angle;
}
