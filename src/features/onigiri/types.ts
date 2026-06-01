export type CatPose = 'calm' | 'make' | 'present' | 'show';

export type OnigiriImageKey = `onigiri-${string}`;

export type OnigiriIngredientList = readonly [string, string, string, string];

export interface OnigiriCatalogItem {
  id: OnigiriImageKey;
  order: number;
  name: string;
  ingredients: OnigiriIngredientList;
  description: string;
  imageKey: OnigiriImageKey;
  temporary: boolean;
}
