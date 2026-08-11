export const COLLECTION_GRID_COLUMNS = 3;

/** 좌우 여백과 열 사이 간격을 먼저 뺀 뒤 셀 폭을 정확히 나눈다. */
export function getCollectionGridCellWidth(
  viewportWidth: number,
  horizontalGutter: number,
  gap: number,
): number {
  const contentWidth = Math.max(0, viewportWidth - horizontalGutter * 2);
  const totalGap = gap * (COLLECTION_GRID_COLUMNS - 1);
  return Math.max(0, (contentWidth - totalGap) / COLLECTION_GRID_COLUMNS);
}
