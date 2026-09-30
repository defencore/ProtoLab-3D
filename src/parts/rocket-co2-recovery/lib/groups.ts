import type { Piece } from './model';

/** Explicit subassembly ownership; independent of display labels and model state. */
export const groups = {
  upper: ['Airframe', 'Upper - electronics tube'],
  lower: ['Airframe', 'Lower - parachute and payload tubes'],
  nose: ['Airframe', 'Nose fairing'],
  motor: ['Airframe', 'Motor interface'],
  externalScrews: ['External fasteners', 'Metal screws'],
  shearScrews: ['External fasteners', 'Nylon shear screws'],
  noseStructure: ['Structure', 'Separating bulkhead and seal'],
  bodyStructure: ['Structure', 'Body bulkheads and load path'],
  deployment: ['CO2 deployment', 'Cartridge and dispenser'],
  canopy: ['Parachute', 'Packed drogue and main'],
  harness: ['Parachute', 'Bridles and nose anchor'],
  battery: ['Electronics', 'Battery pack and retention'],
  moduleMount: ['Electronics', 'Removable module mounting screws'],
  controller: ['Electronics', 'Flight controller and mounts'],
  finder: ['Electronics', 'Tracker - buzzer - PWM switch'],
  payload: ['Electronics', 'Lower payload installation space'],
} as const;

export function grouped(items: Piece[], group: readonly string[]): Piece[] {
  return items.map((item) => ({ ...item, group: item.group ?? group }));
}
