// 홈 카드의 문구 계산.
//
// "약 6분" 은 출퇴근·자투리 시간 사용자가 시작 전에 가장 알고 싶어 하는 정보라
// 히어로 메타에 반드시 남긴다.

const SECONDS_PER_NEW = 18;
const SECONDS_PER_REVIEW = 8;

/** 최소 1분. 대략치라 반올림한다. */
export function estimateStudyMinutes(newCount: number, reviewCount: number): number {
  const seconds = newCount * SECONDS_PER_NEW + reviewCount * SECONDS_PER_REVIEW;
  if (seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** "8월 7일 목요일". */
export function formatKoreanDate(date: Date): string {
  const weekday = WEEKDAYS[date.getDay()] ?? '';
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}요일`;
}

/** 다음 재료 이름은 스포일러라 노출하지 않는다 — 개수만 말한다. */
export function ingredientCaption(count: number): string {
  if (count <= 0) return '학습을 마치면 첫 재료가 들어와요';
  return `재료 ${count}개 모았어요`;
}

const REMAINING_WORDS = ['', '한', '두', '세', '네'] as const;

/** "완성까지 세 번 남았어요". */
export function remainingCaption(remaining: number): string {
  if (remaining <= 0) return '완성했어요';
  const word = REMAINING_WORDS[remaining];
  return word ? `완성까지 ${word} 번 남았어요` : `완성까지 ${remaining}번 남았어요`;
}
