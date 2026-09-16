import { Box3, Vector3 } from 'three';
import native from './native.json';
import * as original from './model';
import * as assembly from '../assembly';
import { box, subtract, type Shape } from '../shapes';
import type { Piece } from '../assembly';

// Source-solid groups identify physical packages in the pinned Pi 5 STEP.
// A simple, continuous body replaces each connector's contacts and small faces.
const groups: [string, number[], string, number][] = [
  ['USB-A dual port 1', [1339], 'dual-east', 0xaab4bc],
  ['USB-A dual port 2', [1340], 'dual-east', 0xaab4bc],
  ['Ethernet RJ45', [1600, 1601], 'east', 0xaab4bc],
  ['USB-C power', [1939, 1940], 'south', 0xaab4bc],
  ['GPIO 40-pin header', Array.from({ length: 41 }, (_, i) => 1341 + i), 'block', 0x303439],
  ['PoE header', [1382, 1383, 1384, 1385, 1386], 'block', 0x303439],
  ['MIPI connector 1', [1259, 1262], 'slot', 0xc8c0b3],
  ['MIPI connector 2', [1307, 1310], 'slot', 0xc8c0b3],
  ['PCIe connector', [1911, 1913], 'slot', 0xc8c0b3],
  ['Power button', [1875, 1876, 1877], 'block', 0x50545a],
  ['microSD socket', [2680, 2681], 'west', 0xaab4bc],
  ['BCM2712 package', [553, 554, 555], 'block', 0x777d82],
  ['RAM package', [0], 'block', 0x292e33],
  ['RP1 package', [1602], 'block', 0x292e33],
  ['Wireless module', [1417], 'block', 0x777d82],
  ['Power component 1', [491], 'block', 0x444a50],
  ['Power component 2', [1209], 'block', 0x444a50],
  ['Power component 3', [546], 'block', 0x444a50],
  ['Underside component', [2684], 'block', 0x444a50],
];
export function pieces(state: string): Piece[] {
  return groups.map(([label, ids, kind, color]) => {
    const bounds = new Box3();
    for (const id of ids) {
      const b = native.components[id].bounds;
      bounds.expandByPoint(new Vector3(...b.slice(0, 3)));
      bounds.expandByPoint(new Vector3(...b.slice(3, 6)));
    }
    // Solder tails are omitted. Above-board connector bodies do not overlap PCB.
    if (bounds.max.z > 0.1) bounds.min.z = Math.max(bounds.min.z, 1.34);
    const [x, y, z] = bounds.min.toArray(),
      [w, l, h] = bounds.getSize(new Vector3()).toArray();
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
      z: state === 'exploded' ? (bounds.max.z <= 0 ? -10 : 10) : 0,
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
