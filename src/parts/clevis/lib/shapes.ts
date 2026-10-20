export type Vec = [number, number, number];
type Cylinder = {
  kind: 'cylinder';
  radius: number;
  height: number;
  origin: Vec;
  axis: 'z' | 'y';
  segments: number;
};
type Box = { kind: 'box'; size: Vec; origin: Vec };
type BooleanShape = { kind: 'union' | 'subtract' | 'intersect'; children: Shape[] };
type Thread = {
  kind: 'thread';
  radius: number;
  height: number;
  origin: Vec;
  pitch: number;
  hand: number;
  internal: boolean;
};
export type Shape = Cylinder | Box | BooleanShape | Thread;
export const cylinder = (
  radius: number,
  height: number,
  origin: Vec,
  axis: 'z' | 'y' = 'z',
  segments = 48,
): Cylinder => ({ kind: 'cylinder', radius, height, origin, axis, segments });
export const box = (size: Vec, origin: Vec): Box => ({ kind: 'box', size, origin });
export const union = (...children: Shape[]): BooleanShape => ({ kind: 'union', children });
export const subtract = (...children: Shape[]): BooleanShape => ({ kind: 'subtract', children });
export const intersect = (...children: Shape[]): BooleanShape => ({ kind: 'intersect', children });
export const thread = (
  radius: number,
  height: number,
  origin: Vec,
  pitch: number,
  hand: number,
  internal: boolean,
): Thread => ({ kind: 'thread', radius, height, origin, pitch, hand, internal });
