import { pi5Interface } from '../../interface';
import * as original from './model';
import * as assembly from '../../../../core/assembly/electronics/assembly';
import { box, subtract, type Shape } from '../../../../core/assembly/electronics/shapes';
import type { Piece } from '../../../../core/assembly/electronics/assembly';

// Source-solid groups identify physical packages in the pinned Pi 5 STEP.
// A simple, continuous body replaces each connector's contacts and small faces.
export function pieces(state: string): Piece[] {
  return pi5Interface.packages.map(({ label, kind, color, bounds }) => {
    const [x, y, z] = bounds.min;
    const [w, l, h] = bounds.max.map((value, axis) => value - bounds.min[axis]);
    const body = box([w, l, h], [x, y, z]);
    const wall = Math.min(0.55, h / 5),
      cuts: Shape[] = [];
    if (kind === 'east' || kind === 'dual-east') {
      const count = kind === 'dual-east' ? 2 : 1;
      const opening = (h - (count + 1) * wall) / count;
      for (let i = 0; i < count; i++)
        cuts.push(
          box([w, l - 2 * wall, opening], [x + wall, y + wall, z + wall + i * (opening + wall)]),
        );
    } else if (kind === 'south') {
      cuts.push(box([w - 2 * wall, l, h - 2 * wall], [x + wall, y - wall, z + wall]));
    } else if (kind === 'west') {
      cuts.push(box([w, l - 2 * wall, h - 2 * wall], [x - wall, y + wall, z + wall]));
    } else if (kind === 'slot') {
      cuts.push(box([w - 2 * wall, l - 2 * wall, h], [x + wall, y + wall, z + wall]));
    }
    return {
      shape: cuts.length ? subtract(body, ...cuts) : body,
      label,
      color,
      z: state === 'exploded' ? (bounds.max[2] <= 0 ? -10 : 10) : 0,
    };
  });
}
export function geometry(state: string) {
  const result = original.geometry(state, [2688]);
  result.children[0].name = 'PCB · original mounting geometry';
  const packages = assembly.geometry(pieces(state));
  result.add(...[...packages.children]);
  return result;
}
export function dimensions(state: string): [number, number, number] {
  // The retained packages contain all six extrema of the original assembly.
  return original.dimensions(state);
}
export function python(state: string) {
  return [
    original.python(state, [2688]),
    '_pcb_shape = components[0]',
    assembly.python(pieces(state)),
    'components.insert(0, _pcb_shape)',
    'component_labels.insert(0, "PCB · original mounting geometry")',
    'component_colors.insert(0, (0.13,0.46,0.28))',
    'shape = Part.makeCompound(components)',
  ].join('\n');
}
