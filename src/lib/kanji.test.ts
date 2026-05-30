import { describe, expect, it } from 'vitest';
import { buildNaverJaDictSearchUrl, extractUniqueKanji } from './kanji';

describe('extractUniqueKanji', () => {
  it('keeps kanji in word order and removes duplicates', () => {
    expect(extractUniqueKanji('勉強', '強い')).toEqual(['勉', '強']);
  });

  it('returns an empty list for kana-only words', () => {
    expect(extractUniqueKanji('ありがとう', 'テレビ')).toEqual([]);
  });
});

describe('buildNaverJaDictSearchUrl', () => {
  it('encodes query text for Naver Japanese dictionary search', () => {
    expect(buildNaverJaDictSearchUrl('勉強 する')).toBe(
      'https://ja.dict.naver.com/#/search?query=%E5%8B%89%E5%BC%B7%20%E3%81%99%E3%82%8B',
    );
  });
});
