import type { Shape } from '../../../core/assembly/boundary/shapes';
import type { ManufacturingProcess } from '../../../core/product-types';

export interface DetailSpec {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  material: string;
  blank: string;
  processes: ManufacturingProcess[];
  requirements?: string[];
  /** Displacement for inspection only, never an installed mounting coordinate. */
  explode?: [number, number, number];
}

export interface MountLayout {
  baseThickness: number;
  switchX: number;
  switchZ: number;
  servoX: number;
  servoZ: number;
  contactZ: number;
  deckBottom: number;
  deckTop: number;
  guideY: number;
  guideEnds: [number, number];
}
