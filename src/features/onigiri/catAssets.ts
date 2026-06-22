import type { ImageSourcePropType } from 'react-native';
import type { CatPose } from './types';

export const catImages: Record<CatPose, ImageSourcePropType> = {
  calm: require('../../../assets/onigiri/cat-calm.png'),
  make: require('../../../assets/onigiri/cat-make.png'),
  present: require('../../../assets/onigiri/cat-present.png'),
  show: require('../../../assets/onigiri/cat-show.png'),
};

// PNG 원본 픽셀 치수 — 포즈마다 비율이 달라(특히 make는 가로형) 고정 aspectRatio 사용 금지.
export const catImageSizes: Record<CatPose, { width: number; height: number }> = {
  calm: { width: 482, height: 745 },
  make: { width: 1446, height: 1230 },
  present: { width: 609, height: 933 },
  show: { width: 609, height: 988 },
};

export function catAspectRatio(pose: CatPose): number {
  const { width, height } = catImageSizes[pose];
  return width / height;
}
