// 고양이 카드 도감 — 시즌1 카탈로그.
// Plan Ref: §7.2 AD-04 — 카드는 개별 고양이. breed 는 사진 소스 한정용 숨은 필드다.
// id 에 진행도가 매달리므로 변경하지 않는다. 시즌2는 cat-011 부터 이어붙인다.

export type Rarity = 'N' | 'R' | 'SR';

export interface CatCard {
  id: string;
  season: number;
  name: string;
  description: string;
  rarity: Rarity;
  /** 사진 소스 한정용. 화면에는 노출하지 않는다. */
  breed: string;
  /** 실제 에셋은 cardAssets.ts 가 매핑한다. catalog 는 순수 데이터로 유지한다. */
  imageKey: string;
  /** 직접 선정·권리 확인한 사진만 공유를 허용한다. Plan Ref: §5 R-02 */
  shareable: boolean;
}

// 원본 카드 아트에는 무지개 테두리가 인쇄돼 있었다. 우리 홀로 오버레이와 겹쳐서
// 어느 쪽이 동작하는지 구분이 안 되므로 사방 50px 을 잘라냈다. (1062x1481 -> 962x1381)
export const CARD_ASPECT_RATIO = 962 / 1381;

export const SEASON_1: readonly CatCard[] = [
  { id: 'cat-001', season: 1, name: '광주리 고양이', description: '광주리에 담긴 고양이. 처다보면 싫어한다.', rarity: 'N', breed: 'Calico', imageKey: 'cat-001', shareable: true },
  { id: 'cat-002', season: 1, name: '창틀 고양이', description: '해 드는 자리를 하루 종일 지킨다.', rarity: 'N', breed: 'Russian Blue', imageKey: 'cat-001', shareable: true },
  { id: 'cat-003', season: 1, name: '식빵 고양이', description: '앞발을 접고 앉으면 아무도 못 말린다.', rarity: 'N', breed: 'Munchkin', imageKey: 'cat-001', shareable: true },
  { id: 'cat-004', season: 1, name: '상자 고양이', description: '상자만 보면 일단 들어가고 본다.', rarity: 'N', breed: 'American Shorthair', imageKey: 'cat-001', shareable: true },
  { id: 'cat-005', season: 1, name: '이불 고양이', description: '사람이 자려고 누우면 그때 올라온다.', rarity: 'N', breed: 'Scottish Fold', imageKey: 'cat-001', shareable: true },
  { id: 'cat-006', season: 1, name: '책상 고양이', description: '가장 바쁠 때 키보드 위에 앉는다.', rarity: 'N', breed: 'Norwegian Forest', imageKey: 'cat-001', shareable: true },
  { id: 'cat-007', season: 1, name: '새벽 고양이', description: '해 뜨기 두 시간 전에 밥그릇을 두드린다.', rarity: 'R', breed: 'Bengal', imageKey: 'cat-001', shareable: true },
  { id: 'cat-008', season: 1, name: '지붕 고양이', description: '어떻게 올라갔는지 아무도 모른다.', rarity: 'R', breed: 'Abyssinian', imageKey: 'cat-001', shareable: true },
  { id: 'cat-009', season: 1, name: '골목 고양이', description: '눈은 마주치지만 절대 가까이 오지 않는다.', rarity: 'R', breed: 'Turkish Angora', imageKey: 'cat-001', shareable: true },
  { id: 'cat-010', season: 1, name: '한밤 고양이', description: '불을 끄면 그제야 진짜 모습이 된다.', rarity: 'SR', breed: 'Bombay', imageKey: 'cat-001', shareable: true },
];

/** 등급 초기 가중치. tier 완주 시 남은 tier 로 정규화 재분배된다. Plan Ref: §7.2 AD-03 */
export const RARITY_WEIGHTS: Readonly<Record<Rarity, number>> = { N: 65, R: 30, SR: 5 };

export const RARITY_LABEL: Readonly<Record<Rarity, string>> = {
  N: '노멀',
  R: '레어',
  SR: '슈퍼레어',
};
