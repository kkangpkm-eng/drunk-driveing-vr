import { roadCenterX, isOnStraight } from "./road.js";

// 각 횡단보도의 설정값(crosswalkDefaults + 항목별 덮어쓰기)을 합친다.
export function resolveCrosswalkConfig(config, index) {
  const d = config.crosswalkDefaults;
  const item = config.crosswalks[index];
  return {
    ...d,
    ...item,
    crosswalk: { ...d.crosswalk, ...item.crosswalk },
    stopLine: { ...d.stopLine, ...item.stopLine },
    signal: { ...d.signal, ...item.signal },
    pedestrians: item.pedestrians ?? config.pedestrians.list,
  };
}

// 횡단보도 관련 z 좌표를 config에서 한 번에 계산한다.
// 도로(차선 끊김), 배경(나무/건물 배치 제외), 신호/보행자/앞차 로직이 모두 같은 값을 쓴다.
// 진행 방향(+Z) 순서: 정지선 → 횡단보도(near~far) → (교차로면) 교차 도로
export function getCrosswalkLayouts(config) {
  return config.crosswalks.map((_, index) => {
    const c = resolveCrosswalkConfig(config, index);
    const z = c.z;
    const crossHalf = c.crossRoadHalfWidthM;
    const crosswalkFarZ = c.crossRoad ? z - crossHalf - c.crosswalk.gapToCrossRoadM : z + c.crosswalk.lengthM / 2;
    const crosswalkNearZ = crosswalkFarZ - c.crosswalk.lengthM;
    const stopLineZ = crosswalkNearZ - c.stopLine.distanceBeforeCrosswalkM;
    const clearZMin = stopLineZ - 4;
    const clearZMax = (c.crossRoad ? z + crossHalf : crosswalkFarZ) + 4;
    if (!isOnStraight(clearZMin, clearZMax)) {
      console.warn(`[crosswalks] ${index}번 횡단보도(z=${z})가 직선 구간 밖에 걸쳐 있습니다. road.js CURVE_SEGMENTS를 확인하세요.`);
    }
    return {
      index,
      cfg: c,
      hasCrossRoad: !!c.crossRoad,
      cx: roadCenterX(z),
      z,
      crossHalf,
      crosswalkNearZ,
      crosswalkFarZ,
      stopLineZ,
      // 배경 오브젝트를 두지 않을 z 범위
      clearZMin,
      clearZMax,
    };
  });
}
