import { describe, expect, it } from 'vitest';
import { resolveStudyRoute } from './studyEntryRoute';

describe('resolveStudyRoute', () => {
  it('복습이 남아 있으면 학습으로 보낸다', () => {
    expect(resolveStudyRoute({ due: 3, newAvail: 0 })).toBe('/study');
  });

  it('신규가 남아 있으면 학습으로 보낸다', () => {
    expect(resolveStudyRoute({ due: 0, newAvail: 5 })).toBe('/study');
  });

  it('둘 다 있으면 학습으로 보낸다', () => {
    expect(resolveStudyRoute({ due: 2, newAvail: 7 })).toBe('/study');
  });

  it('오늘 몫이 비면 약점 복습으로 보낸다', () => {
    expect(resolveStudyRoute({ due: 0, newAvail: 0 })).toBe('/weakness');
  });
});
