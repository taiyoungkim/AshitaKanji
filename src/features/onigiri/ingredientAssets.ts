// 재료 키 → 한국어 이름 + 일러스트.
// 아트는 Onikan 핸드오프의 선화 PNG 를 그대로 쓴다 (검정 선화라 plate 타일 위에 올린다).

import type { ImageSourcePropType } from 'react-native';

export interface IngredientMeta {
  name: string;
  image: ImageSourcePropType;
}

export const INGREDIENTS: Record<string, IngredientMeta> = {
  RICE: { name: '밥', image: require('../../../assets/onigiri/ingredients/rice.png') },
  RICE_GRAIN: {
    name: '쌀알',
    image: require('../../../assets/onigiri/ingredients/rice-grain.png'),
  },
  NORI: { name: '김', image: require('../../../assets/onigiri/ingredients/nori.png') },
  NORI_FLAKES: {
    name: '김가루',
    image: require('../../../assets/onigiri/ingredients/nori-flakes.png'),
  },
  TUNA: { name: '참치', image: require('../../../assets/onigiri/ingredients/tuna.png') },
  MAYO: { name: '마요네즈', image: require('../../../assets/onigiri/ingredients/mayo.png') },
  SALMON: { name: '연어', image: require('../../../assets/onigiri/ingredients/salmon.png') },
  SALMON_ROE: {
    name: '연어알',
    image: require('../../../assets/onigiri/ingredients/salmon-roe.png'),
  },
  POLLOCK_ROE: {
    name: '명란',
    image: require('../../../assets/onigiri/ingredients/pollock-roe.png'),
  },
  UMEBOSHI: {
    name: '우메보시',
    image: require('../../../assets/onigiri/ingredients/umeboshi.png'),
  },
  PERILLA: { name: '깻잎', image: require('../../../assets/onigiri/ingredients/perilla.png') },
  SESAME: { name: '참깨', image: require('../../../assets/onigiri/ingredients/sesame.png') },
  BLACK_SESAME: {
    name: '흑임자',
    image: require('../../../assets/onigiri/ingredients/black-sesame.png'),
  },
  SESAME_OIL: {
    name: '참기름',
    image: require('../../../assets/onigiri/ingredients/sesame-oil.png'),
  },
  SALT: { name: '소금', image: require('../../../assets/onigiri/ingredients/salt.png') },
  PEPPER: { name: '후추', image: require('../../../assets/onigiri/ingredients/pepper.png') },
  SAUCE: { name: '간장소스', image: require('../../../assets/onigiri/ingredients/sauce.png') },
  TERIYAKI: {
    name: '데리야키',
    image: require('../../../assets/onigiri/ingredients/teriyaki.png'),
  },
  DOENJANG: { name: '된장', image: require('../../../assets/onigiri/ingredients/doenjang.png') },
  GOCHUJANG: {
    name: '고추장',
    image: require('../../../assets/onigiri/ingredients/gochujang.png'),
  },
  CHILI: { name: '고추', image: require('../../../assets/onigiri/ingredients/chili.png') },
  WASABI: { name: '와사비', image: require('../../../assets/onigiri/ingredients/wasabi.png') },
  KIMCHI: { name: '김치', image: require('../../../assets/onigiri/ingredients/kimchi.png') },
  BULGOGI: { name: '불고기', image: require('../../../assets/onigiri/ingredients/bulgogi.png') },
  BACON: { name: '베이컨', image: require('../../../assets/onigiri/ingredients/bacon.png') },
  SHRIMP: { name: '새우', image: require('../../../assets/onigiri/ingredients/shrimp.png') },
  SHRIMP_TEMPURA: {
    name: '새우튀김',
    image: require('../../../assets/onigiri/ingredients/shrimp-tempura.png'),
  },
  EGG: { name: '계란', image: require('../../../assets/onigiri/ingredients/egg.png') },
  CHEESE: { name: '치즈', image: require('../../../assets/onigiri/ingredients/cheese.png') },
  BUTTER: { name: '버터', image: require('../../../assets/onigiri/ingredients/butter.png') },
  MILK: { name: '우유', image: require('../../../assets/onigiri/ingredients/milk.png') },
  CURRY: { name: '카레', image: require('../../../assets/onigiri/ingredients/curry.png') },
  POTATO: { name: '감자', image: require('../../../assets/onigiri/ingredients/potato.png') },
  CARROT: { name: '당근', image: require('../../../assets/onigiri/ingredients/carrot.png') },
  ONION: { name: '양파', image: require('../../../assets/onigiri/ingredients/onion.png') },
  GREEN_ONION: {
    name: '쪽파',
    image: require('../../../assets/onigiri/ingredients/green-onion.png'),
  },
  GREEN_PEAS: {
    name: '완두콩',
    image: require('../../../assets/onigiri/ingredients/green-peas.png'),
  },
  RED_BEAN: { name: '팥', image: require('../../../assets/onigiri/ingredients/red-bean.png') },
  SOYBEAN_POWDER: {
    name: '콩가루',
    image: require('../../../assets/onigiri/ingredients/soybean-powder.png'),
  },
  BURDOCK: { name: '우엉', image: require('../../../assets/onigiri/ingredients/burdock.png') },
  GARLIC: { name: '마늘', image: require('../../../assets/onigiri/ingredients/garlic.png') },
  LETTUCE: { name: '양상추', image: require('../../../assets/onigiri/ingredients/lettuce.png') },
  CUCUMBER: {
    name: '오이',
    image: require('../../../assets/onigiri/ingredients/cucumber-leaf.png'),
  },
  PARSLEY: { name: '파슬리', image: require('../../../assets/onigiri/ingredients/parsley.png') },
  FURIKAKE: { name: '후리카케', image: require('../../../assets/onigiri/ingredients/furikake.png') },
};

export function ingredientName(key: string): string {
  return INGREDIENTS[key]?.name ?? key;
}

export function ingredientImage(key: string): ImageSourcePropType | undefined {
  return INGREDIENTS[key]?.image;
}
