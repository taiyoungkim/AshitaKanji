import type { ImageSourcePropType } from 'react-native';

/** 2026-09 디자인 핸드오프에서 전달된 온보딩·홈 원본 에셋. */
export const onboardingImages: Record<
  'intro' | 'guide' | 'finish' | 'home' | 'regularEmpty',
  ImageSourcePropType
> = {
  intro: require('../../../assets/onboarding/intro-mascot.png'),
  guide: require('../../../assets/onboarding/guide-mascot.png'),
  finish: require('../../../assets/onboarding/finish-mascot.png'),
  home: require('../../../assets/onboarding/home-mascot.png'),
  regularEmpty: require('../../../assets/onboarding/regular-empty.png'),
};
