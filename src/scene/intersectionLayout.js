import { roadCenterX } from "./road.js";

// 교차로 관련 z 좌표를 config에서 한 번에 계산한다.
// 도로(차선 끊김), 배경(나무/건물 배치 제외), 신호/보행자 로직이 모두 같은 값을 쓴다.
// 진행 방향(+Z) 순서: 정지선 → 횡단보도(near~far) → 교차 도로
export function getIntersectionLayout(config) {
  const it = config.intersection;
  const z = it.z;
  const crossHalf = it.crossRoadHalfWidthM;
  const crosswalkFarZ = z - crossHalf - it.crosswalk.gapToCrossRoadM;
  const crosswalkNearZ = crosswalkFarZ - it.crosswalk.lengthM;
  const stopLineZ = crosswalkNearZ - it.stopLine.distanceBeforeCrosswalkM;
  return {
    cx: roadCenterX(z),
    z,
    crossHalf,
    crosswalkNearZ,
    crosswalkFarZ,
    stopLineZ,
    // 배경 오브젝트를 두지 않을 z 범위
    clearZMin: stopLineZ - 4,
    clearZMax: z + crossHalf + 4,
  };
}
