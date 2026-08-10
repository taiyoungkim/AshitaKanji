// 완성 오니기리 일러스트. 현재 24종 중 10종만 아트가 준비되어 있다 —
// 나머지는 undefined 를 돌려주고, 화면은 빈 plate 타일로 그린다(가짜 그림을 대신 넣지 않는다).

import type { ImageSourcePropType } from 'react-native';
import type { OnigiriImageKey } from './types';

const RECIPE_IMAGES: Partial<Record<OnigiriImageKey, ImageSourcePropType>> = {
  'onigiri-001': require('../../../assets/onigiri/recipes/01-tuna-mayo.png'),
  'onigiri-002': require('../../../assets/onigiri/recipes/02-salmon.png'),
  'onigiri-003': require('../../../assets/onigiri/recipes/03-umeboshi.png'),
  'onigiri-004': require('../../../assets/onigiri/recipes/04-perilla.png'),
  'onigiri-005': require('../../../assets/onigiri/recipes/05-tuna-mayo-alt.png'),
  'onigiri-006': require('../../../assets/onigiri/recipes/06-pollock-roe.png'),
  'onigiri-007': require('../../../assets/onigiri/recipes/07-salmon-roe.png'),
  'onigiri-008': require('../../../assets/onigiri/recipes/08-red-bean.png'),
  'onigiri-009': require('../../../assets/onigiri/recipes/09-green-peas.png'),
  'onigiri-010': require('../../../assets/onigiri/recipes/10-shrimp-tempura.png'),
};

export function recipeImage(key: OnigiriImageKey): ImageSourcePropType | undefined {
  return RECIPE_IMAGES[key];
}

/** 사장 마스코트 — 홈 인사와 튜토리얼에 쓰는 선화. */
export const mascotImage: ImageSourcePropType = require('../../../assets/onigiri/mascot.png');
