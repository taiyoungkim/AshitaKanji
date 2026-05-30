// Design Ref: §5.3 — cardType 분기 로직 단위 테스트
// SC: 5종 타입 정확 분기, shouldHideReading = A/B/E만 true

import { describe, expect, it } from 'vitest';
import type { CardType, Word } from '~/types/Card';
import { renderKanjiFace, shouldHideReading, CARD_TYPE_LABEL_KO, CARD_TYPE_COLOR } from './cardType';

function w(card_type: CardType, surface: string): Word {
  return {
    id: 't', level: 'N5', surface, reading_kana: 'x', meaning_ko: 'x',
    card_type, qa_status: 'verified', deprecated: 0, data_version: 0,
  };
}

describe('renderKanjiFace', () => {
  it('returns surface for all types', () => {
    expect(renderKanjiFace(w('A', '勉強'))).toBe('勉強');
    expect(renderKanjiFace(w('D', 'テレビ'))).toBe('テレビ');
  });
});

describe('shouldHideReading', () => {
  it('hides reading for A/B/E (kanji-bearing)', () => {
    expect(shouldHideReading(w('A', '勉強'))).toBe(true);
    expect(shouldHideReading(w('B', '食べる'))).toBe(true);
    expect(shouldHideReading(w('E', 'お土産'))).toBe(true);
  });
  it('shows reading for C/D (kana only)', () => {
    expect(shouldHideReading(w('C', 'ありがとう'))).toBe(false);
    expect(shouldHideReading(w('D', 'テレビ'))).toBe(false);
  });
});

describe('label/color maps', () => {
  it('covers all 5 types', () => {
    const types: CardType[] = ['A', 'B', 'C', 'D', 'E'];
    for (const t of types) {
      expect(CARD_TYPE_LABEL_KO[t]).toBeTruthy();
      expect(CARD_TYPE_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
