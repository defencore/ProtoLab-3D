import {
  cylinder,
  prism,
  subtract,
  union,
  pythonShape,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { bearingCheekSlots, type CheekFrame } from './bearing-cheeks';
import { frameLayout, mechanismLayout } from './layout';

export type PlatePoint = [number, number];
export type PlateCut =
  | {
      kind: 'circle';
      id: string;
      center: PlatePoint;
      radius: number;
      pilotRadius?: number;
      operation?: 'ream';
    }
  | { kind: 'polygon'; id: string; points: PlatePoint[] };
export interface SharedFrame extends CheekFrame {
  discDiameter?: number;
  columnRadius?: number;
  columnClock?: number;
}
export interface SharedPlate {
  id: 'motor' | 'fixed' | 'end';
  label: string;
  thickness: 3;
  stationX: number;
  color: number;
  shape: Shape;
  outer: { kind: 'circle'; center: PlatePoint; radius: number };
  cuts: PlateCut[];
  placement: { translation: Vec; rotation: Vec };
  portPolicy: string;
}

/** Exactly three round discs; all four source channels have one common X station. */
export function sharedPlates(frame: SharedFrame = frameLayout): SharedPlate[] {
  const discRadius = (frame.discDiameter ?? frameLayout.discDiameter) / 2;
  const columnRadius = frame.columnRadius ?? frameLayout.columnRadius;
  const slots = bearingCheekSlots(frame);
  return [
    { id: 'motor' as const, x: frameLayout.plateStations[0] },
    { id: 'fixed' as const, x: frameLayout.plateStations[1] },
    { id: 'end' as const, x: frameLayout.plateStations[2] },
  ].map((role): SharedPlate => {
    const cuts: PlateCut[] = [];
    for (let index = 0; index < 4; index++) {
      const angle = (((frame.columnClock ?? frameLayout.columnClock) + index * 90) * Math.PI) / 180;
      cuts.push({
        kind: 'circle',
        id: `column-${index + 1}`,
        radius: 1.7,
        center: [columnRadius * Math.cos(angle), columnRadius * Math.sin(angle)],
      });
    }
    for (let unit = 0; unit < 4; unit++) {
      const angle = ((frame.clock + unit * 90) * Math.PI) / 180;
      const point = ([y, z]: PlatePoint): PlatePoint => [
        (frame.radius + y) * Math.cos(angle) - z * Math.sin(angle),
        (frame.radius + y) * Math.sin(angle) + z * Math.cos(angle),
      ];
      const circle = (id: string, z: number, radius: number, ream = false) => {
        cuts.push({
          kind: 'circle',
          id: `channel-${unit + 1}-${id}`,
          center: point([0, z]),
          radius,
          ...(ream ? { pilotRadius: 6.4, operation: 'ream' as const } : {}),
        });
      };
      if (role.id === 'motor') {
        circle('motor-boss', mechanismLayout.screwZ, 3.1);
        for (const offset of [-5.25, 5.25])
          circle(`motor-M2-${offset}`, mechanismLayout.screwZ + offset, 1.1);
      } else circle('screw-bearing-seat', mechanismLayout.screwZ, 6.51, true);
    }
    for (const slot of slots.filter((slot) => slot.plateId === role.id))
      cuts.push({ kind: 'polygon', id: slot.id, points: slot.points });
    const plate: Omit<SharedPlate, 'shape'> = {
      id: role.id,
      label: `Shared radial ${role.id} disc · Ø${2 * discRadius} × 3 mm laser steel`,
      thickness: 3,
      stationX: role.x,
      color: 0xb6bec6,
      outer: { kind: 'circle', center: [0, 0], radius: discRadius },
      cuts,
      placement: { translation: [role.x, 0, 0], rotation: [90, 0, 90] },
      portPolicy:
        'Three exact circular discs. Four channels share the same axial stations; no passing-channel windows or staggered frame planes.',
    };
    return { ...plate, shape: sharedPlateShape(plate) };
  });
}

/** Laser stock has Ø12.8 pilots; the installed model has Ø13.02 fit envelopes. */
export function sharedPlateShape(
  plate: Pick<SharedPlate, 'cuts' | 'outer' | 'placement'>,
  stage: 'cut' | 'finished' = 'finished',
  flat = false,
): Shape {
  const cuts = plate.cuts.map((cut): Shape =>
    cut.kind === 'circle'
      ? cylinder(stage === 'cut' ? (cut.pilotRadius ?? cut.radius) : cut.radius, 3.2, [
          cut.center[0],
          cut.center[1],
          -0.1,
        ])
      : prism(cut.points, 3.2, -0.1),
  );
  const source = subtract(cylinder(plate.outer.radius, 3, [0, 0, 0]), union(...cuts));
  return flat ? source : { kind: 'transform', child: source, ...plate.placement };
}

export function sharedPlateNativeSource(
  plate: SharedPlate,
  stage: 'cut' | 'finished' = 'finished',
  flat = true,
): string {
  return `def _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):\n        if angle: shape.rotate(App.Vector(),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape=(${pythonShape(sharedPlateShape(plate, stage, flat))}).removeSplitter()\n`;
}

/** SHA256 input for binding the exact native cut sources to frozen laser files. */
export function sharedPlateProfileSource(frame: SharedFrame = frameLayout): string {
  return JSON.stringify(
    sharedPlates(frame).map((plate) => ({
      id: plate.id,
      stationX: plate.stationX,
      source: sharedPlateNativeSource(plate, 'cut', true),
    })),
  );
}
