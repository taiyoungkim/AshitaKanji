// Design Ref: §5.3 — cardType 분기 로직 단위 테스트
// SC: 5종 타입 정확 분기, shouldHideReading = A/B/E만 true

import { describe, expect, it } from 'vitest';
import type { CardType, Word } from '~/types/Card';
import { renderKanjiFace, shouldHideReading, posLabelKo, CARD_TYPE_LABEL_KO, CARD_TYPE_COLOR } from './cardType';

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

describe('posLabelKo', () => {
  it('maps JMdict-derived POS to Korean labels', () => {
    expect(posLabelKo('noun')).toBe('명사');
    expect(posLabelKo('verb')).toBe('동사');
    expect(posLabelKo('adjective')).toBe('형용사');
    expect(posLabelKo('adverb')).toBe('부사');
    expect(posLabelKo('pronoun')).toBe('대명사');
    expect(posLabelKo('numeral')).toBe('수사');
    expect(posLabelKo('counter')).toBe('조수사');
    expect(posLabelKo('conjunction')).toBe('접속사');
    expect(posLabelKo('particle')).toBe('조사');
    expect(posLabelKo('interjection')).toBe('감탄사');
    expect(posLabelKo('prefix')).toBe('접두사');
    expect(posLabelKo('suffix')).toBe('접미사');
    expect(posLabelKo('expression')).toBe('표현');
  });
  it('is case-insensitive', () => {
    expect(posLabelKo('NOUN')).toBe('명사');
  });
  it('returns null for empty, raw for unknown', () => {
    expect(posLabelKo(null)).toBeNull();
    expect(posLabelKo(undefined)).toBeNull();
    expect(posLabelKo('')).toBeNull();
    expect(posLabelKo('mystery')).toBe('mystery');
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
