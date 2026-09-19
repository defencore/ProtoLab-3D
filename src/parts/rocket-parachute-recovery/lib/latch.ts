import {
  box,
  cylinder,
  ring,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
} from '../../rocket-release/lib/shapes';
import { at } from '../../rocket-release/lib/motion';

export const latchPhases = [0, 120, 240];
export const seamAngles = [45, 135, 225, 315];
export const latch = {
  inner: 32.5,
  innerEnd: 35.5,
  eye: 35.9,
  eyeEnd: 38.9,
  outer: 39.3,
  outerEnd: 42.3,
  width: 8,
  thickness: 4,
  stroke: 8,
  sideClearance: 0.15,
  corner: 1,
};
/** Rounded rectangular section extruded radially; R1 windows accept a D2 end mill. */
export function bladePrism(
  length: number,
  width: number,
  height: number,
  x: number,
  z: number,
): Shape {
  const r = latch.corner;
  return union(
    box([length, width - 2 * r, height], [x, -width / 2 + r, z]),
    box([length, width, height - 2 * r], [x, -width / 2, z + r]),
    ...[-1, 1].flatMap((sign) =>
      [z + r, z + height - r].map((h) =>
        transform(rotate(cylinder(r, length, [0, 0, 0]), 90, 'y'), 0, [
          x,
          sign * (width / 2 - r),
          h,
        ]),
      ),
    ),
  );
}
/** Integral nose cheeks. Local servo coordinates, inverted into the recovery frame later. */
export function noseCheeks(): Shape {
  return union(
    ...latchPhases.map((a) =>
      transform(
        subtract(
          union(box([3, 12, 11], [latch.inner, -6, 46]), box([3, 12, 11], [latch.outer, -6, 46])),
          bladePrism(11, 8.3, 4.3, 32, 49.65),
        ),
        a,
      ),
    ),
  );
}
/** Fixed body eyes between the two moving nose cheeks, with spring reaction seats. */
export function bodyReceiver(original: Shape): Shape {
  return subtract(
    union(
      subtract(original, cylinder(43, 14, [0, 0, -5])),
      ring(42.75, 32.75, -5, 3.5),
      ...latchPhases.map((a) =>
        transform(
          subtract(
            box([3, 12, 14.5], [latch.eye, -6, -5]),
            bladePrism(3.2, 8.3, 4.3, latch.eye - 0.1, 2.05),
          ),
          -a,
        ),
      ),
      ...seamAngles.map((a) => cylinder(3.2, 13, [...at(36.25, -a), -5])),
    ),
    ...seamAngles.map((a) => cylinder(5.2, 2.2, [...at(36.25, -a), 8.3])),
  );
}
