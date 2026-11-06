import { Box3, Group, Vector3 } from 'three';
import type { Parameters } from '../../../../core/types';
import { n, num } from '../../../../core/geometry';
import { disposeModel } from '../../../../core/mechanical';
import {
  box,
  component,
  cylinder,
  pythonShape,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../standard/shapes';

type Component = {
  shape: Shape;
  label: string;
  color: number;
  shift: Vec;
  angle: number;
};

function roundedCase(length: number, width: number, height: number): Shape {
  const radius = 0.9;
  return union(
    box([length - 2 * radius, width, height], [-length / 2 + radius, -width / 2, 0]),
    box([length, width - 2 * radius, height], [-length / 2, -width / 2 + radius, 0]),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        cylinder(radius, height, [sx * (length / 2 - radius), sy * (width / 2 - radius), 0]),
      ),
    ),
  );
}

// The manufacturer drawing specifies face mounting, with no projecting ears.
// Nominal M2 bores omit helical threads; their depths remain illustrative.
export function mountingPoints(p: Parameters, face: 'front' | 'rear'): Vec[] {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy): Vec => [
      (sx * n(p, `${face}MountPitchX`)) / 2,
      (sy * n(p, `${face}MountPitchY`)) / 2,
      face === 'front' ? n(p, 'bodyHeight') : 0,
    ]),
  );
}

export function assembly(p: Parameters, state: string): Component[] {
  const height = n(p, 'bodyHeight');
  const holeDepth = n(p, 'mountHoleDepth');
  const shaftX = n(p, 'shaftOffset');
  const shaftRadius = n(p, 'shaftDiameter') / 2;
  const housing = subtract(
    roundedCase(n(p, 'bodyLength'), n(p, 'bodyWidth'), height),
    ...mountingPoints(p, 'front').map(([x, y]) =>
      cylinder(n(p, 'mountHoleDiameter') / 2, holeDepth + 1, [x, y, height - holeDepth]),
    ),
    ...mountingPoints(p, 'rear').map(([x, y]) =>
      cylinder(n(p, 'mountHoleDiameter') / 2, holeDepth + 1, [x, y, -1]),
    ),
  );
  const parts: Component[] = [
    {
      shape: housing,
      label: 'ST3025 housing with face mounting holes',
      color: 0x292c31,
      shift: [0, 0, 0],
      angle: 0,
    },
  ];
  if (state === 'body') return parts;

  parts.push({
    shape: subtract(
      cylinder(shaftRadius, n(p, 'shaftHeight'), [0, 0, height]),
      cylinder(1.1, n(p, 'shaftHeight') + 2, [0, 0, height - 1]),
    ),
    label: 'ST3025 output shaft · illustrative smooth envelope',
    color: 0xc1c5cb,
    shift: [shaftX, 0, state === 'exploded' ? 12 : 0],
    angle: n(p, 'outputAngle'),
  });
  parts.push({
    shape: subtract(
      cylinder(n(p, 'rearPivotDiameter') / 2, n(p, 'rearPivotHeight'), [
        0,
        0,
        -n(p, 'rearPivotHeight'),
      ]),
      cylinder(1.1, n(p, 'rearPivotHeight') + 2, [0, 0, -n(p, 'rearPivotHeight') - 1]),
    ),
    label: 'ST3025 rear support pivot · illustrative smooth envelope',
    color: 0xc1c5cb,
    shift: [shaftX, 0, state === 'exploded' ? -12 : 0],
    angle: 0,
  });

  if (p.showHorn) {
    const reach = n(p, 'hornLength');
    const z = height + 1;
    parts.push({
      shape: subtract(
        union(
          cylinder(6, 3, [0, 0, z]),
          box([reach, 8, 3], [0, -4, z]),
          cylinder(4, 3, [reach, 0, z]),
        ),
        cylinder(shaftRadius + 0.15, 5, [0, 0, z - 1]),
        cylinder(1.25, 5, [reach, 0, z - 1]),
      ),
      label: 'Illustrative single-arm horn',
      color: 0xc8a349,
      shift: [shaftX, 0, state === 'exploded' ? 25 : 0],
      angle: n(p, 'outputAngle'),
    });
  }
  return parts;
}

export function geometry(p: Parameters, state: string): Group {
  const group = new Group();
  for (const item of assembly(p, state)) {
    const placed = new Group();
    placed.name = item.label;
    placed.add(component(item.shape, item.label, item.color, [0, 0, 0]));
    placed.rotation.z = (item.angle * Math.PI) / 180;
    placed.position.set(...item.shift);
    group.add(placed);
  }
  return group;
}

export function dimensions(p: Parameters, state: string): [number, number, number] {
  const model = geometry(p, state);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}

export function python(p: Parameters, state: string): string {
  const parts = assembly(p, state);
  const lines = ['components = []'];
  for (const item of parts) {
    lines.push(`component = ${pythonShape(item.shape)}.removeSplitter()`);
    if (item.angle)
      lines.push(`component.rotate(App.Vector(0, 0, 0), App.Vector(0, 0, 1), ${num(item.angle)})`);
    if (item.shift.some(Boolean))
      lines.push(`component.translate(App.Vector(${item.shift.map(num).join(', ')}))`);
    lines.push('components.append(component)');
  }
  lines.push('shape = Part.makeCompound(components)');
  lines.push(`component_labels = ${JSON.stringify(parts.map((item) => item.label))}`);
  lines.push(
    `component_colors = ${JSON.stringify(parts.map((item) => [((item.color >> 16) & 255) / 255, ((item.color >> 8) & 255) / 255, (item.color & 255) / 255]))}`,
  );
  return lines.join('\n');
}
