import type { ImageSourcePropType } from 'react-native';
import type { CatPose } from './types';

export const catImages: Record<CatPose, ImageSourcePropType> = {
  calm: require('../../../assets/onigiri/cat-calm.png'),
  make: require('../../../assets/onigiri/cat-make.png'),
  present: require('../../../assets/onigiri/cat-present.png'),
  show: require('../../../assets/onigiri/cat-show.png'),
};
