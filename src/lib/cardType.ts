// Design Ref: §5.3 카드 타입별 분기 — presentational helpers (no session/DB deps)
// Plan Ref: §5 Card Type Policy (A 순수한자 / B 한자+오쿠리 / C 순수가나 / D 가타카나 / E 혼합)

import type { CardType, Word } from '~/types/Card';

/** 한자 면(앞면)에 노출할 표기. 모든 타입 surface 그대로. */
export function renderKanjiFace(word: Word): string {
  return word.surface;
}

/**
 * reveal 전 읽기(kana)를 숨길지 여부.
 * Plan SC: A/B/E(한자 포함)만 숨김 → 능동 회상. C/D(가나/가타카나)는 읽기=표기라 숨겨도 무의미.
 */
export function shouldHideReading(word: Word): boolean {
  return word.card_type === 'A' || word.card_type === 'B' || word.card_type === 'E';
}

/** 앞면에서 회상해야 할 대상 라벨 (UX 안내문). */
export function frontPromptKo(word: Word): string {
  return shouldHideReading(word) ? '읽기 + 뜻을 떠올려보세요' : '뜻을 떠올려보세요';
}

/** 카드 타입 한국어 라벨 (디버그/상세용). */
export const CARD_TYPE_LABEL_KO: Record<CardType, string> = {
  A: '순수 한자',
  B: '한자+오쿠리가나',
  C: '순수 히라가나',
  D: '가타카나',
  E: '혼합',
};

/** 카드 타입별 악센트 색 (앞면 배지). */
export const CARD_TYPE_COLOR: Record<CardType, string> = {
  A: '#0366d6',
  B: '#2a9d8f',
  C: '#e9a23b',
  D: '#9b5de5',
  E: '#e76f51',
};
