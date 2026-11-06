import { DARK_STEEL, STEEL } from '../geometry';

/** Shared sRGB values for preview materials and native bearing components. */
export const bearingPalette = {
  race: STEEL,
  darkElement: DARK_STEEL,
  cage: 0xb39b66,
  inclinedCage: 0xb09a63,
  rubberSeal: 0x292d31,
  metalShield: 0xa0a6ac,
  flangedBall: 0x6a7177,
  flangeHousing: 0x284477,
  insertSeal: 0x252d35,
  angularRubberSeal: 0x292f38,
  angularMetalShield: 0xb0b5bc,
  sprag: 0x59616b,
};

export function bearingRgb(color: number): [number, number, number] {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}
