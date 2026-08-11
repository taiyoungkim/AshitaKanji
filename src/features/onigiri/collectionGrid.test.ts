import { describe, expect, it } from 'vitest';
import { getCollectionGridCellWidth } from './collectionGrid';

describe('getCollectionGridCellWidth', () => {
  it.each([390, 412, 448])('keeps exactly three columns at %ipx', (viewportWidth) => {
    const gutter = 20;
    const gap = 12;
    const cellWidth = getCollectionGridCellWidth(viewportWidth, gutter, gap);

    expect(cellWidth * 3 + gap * 2 + gutter * 2).toBeCloseTo(viewportWidth);
  });

  it('does not return a negative width for a transient zero-sized viewport', () => {
    expect(getCollectionGridCellWidth(0, 20, 12)).toBe(0);
  });
});
