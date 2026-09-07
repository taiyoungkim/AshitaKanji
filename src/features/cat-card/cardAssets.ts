// 카드 원본 에셋. catalog.ts 는 순수 데이터로 두고 imageKey 로만 연결한다.
// (onigiri/onboardingAssets.ts 와 동일한 분리 규칙)

import type { ImageSourcePropType } from 'react-native';

// ponytail: 프로토타입 — 사진 1장을 시즌1 10종이 공유한다.
// 실제 사진 10장 확정되면 여기에 cat-002 ~ cat-010 을 추가한다.
//
// 실제 파일명은 cat-001@3x.png 다. require 에는 기본 이름을 쓰고 Metro 가 배율 변형을 찾는다.
// @3x 파일명은 필수다. 접미사가 없으면 Metro 가 drawable-mdpi 에 넣고 Android 가 기기
// 밀도만큼 확대하는데, 카드 원본(1062x1481)은 3배 기기에서 약 1,420만 픽셀 = 57MB
// 비트맵이 되어 디코드에 실패하고 이미지가 아무것도 그려지지 않는다.
// 카드 표시 폭이 최대 340dp 이므로 3배 = 1020px, 원본과 거의 일치한다.
const prototypeCard = require('../../../assets/cat-card/cat-001.png') as ImageSourcePropType;

export const cardImages: Record<string, ImageSourcePropType> = {
  'cat-001': prototypeCard,
};

export function cardImage(imageKey: string): ImageSourcePropType {
  return cardImages[imageKey] ?? prototypeCard;
}
