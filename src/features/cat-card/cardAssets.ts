// 카드 원본 에셋. catalog.ts 는 순수 데이터로 두고 imageKey 로만 연결한다.
// (onigiri/onboardingAssets.ts 와 동일한 분리 규칙)

import type { ImageSourcePropType } from 'react-native';

// ponytail: 프로토타입 — 사진 1장을 시즌1 10종이 공유한다.
// 실제 사진 10장 확정되면 여기에 cat-002 ~ cat-010 을 추가한다.
const prototypeCard = require('../../../assets/cat-card/cat-001.png') as ImageSourcePropType;

export const cardImages: Record<string, ImageSourcePropType> = {
  'cat-001': prototypeCard,
};

export function cardImage(imageKey: string): ImageSourcePropType {
  return cardImages[imageKey] ?? prototypeCard;
}
