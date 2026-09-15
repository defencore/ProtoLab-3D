import { Box3, Group, Vector3 } from 'three';
import type { Parameters } from '../../../../core/types';
import { n, num } from '../../../../core/geometry';
import { box, component, cylinder, pythonShape, subtract, union } from './shapes';
import type { Shape, Vec } from './shapes';

export type Component = {
  shape: Shape;
  label: string;
  color: number;
  shift: Vec;
  angle: number;
};
export function mountingPoints(p: Parameters): Vec[] {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy): Vec => [
      (sx * n(p, 'mountPitchX')) / 2,
      (sy * n(p, 'mountPitchY')) / 2,
      n(p, 'mountBottom'),
    ]),
  );
}
function roundedBox(
  length: number,
  width: number,
  height: number,
  z: number,
  radius: number,
): Shape {
  return union(
    box([length - 2 * radius, width, height], [-length / 2 + radius, -width / 2, z]),
    box([length, width - 2 * radius, height], [-length / 2, -width / 2 + radius, z]),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        cylinder(radius, height, [sx * (length / 2 - radius), sy * (width / 2 - radius), z]),
      ),
    ),
  );
}

export function assembly(p: Parameters, state: string): Component[] {
  const L = n(p, 'bodyLength'),
    W = n(p, 'bodyWidth'),
    H = n(p, 'bodyHeight');
  const span = n(p, 'mountSpan'),
    mountZ = n(p, 'mountBottom'),
    mountT = n(p, 'mountThickness');
  const shaftX = n(p, 'shaftOffset'),
    shaftR = n(p, 'shaftDiameter') / 2;
  const notchR = n(p, 'mountHoleDiameter') / 2;
  const coverT = 1.2;
  let caseBody: Shape = roundedBox(L, W, H - coverT, 0, 1);
  // Shallow external seams and cooling grooves are illustrative envelope details.
  const grooveHeights = [
    H * 0.16,
    ...[0, 1, 2, 3, 4].map((i) => mountZ * 0.36 + i * mountZ * 0.075),
  ];
  caseBody = subtract(
    caseBody,
    ...grooveHeights.map((z) =>
      subtract(
        box([L + 2, W + 2, 0.5], [-L / 2 - 1, -W / 2 - 1, z]),
        box([L - 0.7, W - 0.7, 0.7], [-L / 2 + 0.35, -W / 2 + 0.35, z - 0.1]),
      ),
    ),
  );
  const housing = subtract(
    union(
      caseBody,
      roundedBox(span, W, mountT, mountZ, 0.7),
      roundedBox(L - 1.2, W - 1.2, 0.8, H - coverT, 1),
      cylinder(W * 0.34, coverT, [shaftX, 0, H - coverT]),
    ),
    ...mountingPoints(p).flatMap(([x, y]) => [
      cylinder(notchR, mountT + 2, [x, y, mountZ - 1]),
      // Drawing depicts a circular cutout with a narrow opening toward each end.
      box(
        [span / 2 - Math.abs(x) + 1, notchR * 1.25, mountT + 2],
        [x < 0 ? -span / 2 - 1 : x, y - notchR * 0.625, mountZ - 1],
      ),
    ]),
  );
  const parts: Component[] = [
    {
      shape: housing,
      label: 'Servo housing and mounting ears',
      color: 0x50555c,
      shift: [0, 0, 0],
      angle: 0,
    },
  ];
  if (state === 'body') return parts;
  const shaft = subtract(
    cylinder(shaftR, n(p, 'totalHeight') - H, [0, 0, H]),
    cylinder(1.1, n(p, 'totalHeight') - H + 2, [0, 0, H - 1]),
  );
  parts.push({
    shape: shaft,
    label: 'Output shaft (simplified spline)',
    color: 0xb3bac1,
    shift: [shaftX, 0, state === 'exploded' ? 12 : 0],
    angle: n(p, 'outputAngle'),
  });
  if (p.showHorn) {
    const reach = n(p, 'hornLength'),
      z = H + 1;
    const horn = subtract(
      union(
        cylinder(6, 3, [0, 0, z]),
        box([reach, 8, 3], [0, -4, z]),
        cylinder(4, 3, [reach, 0, z]),
      ),
      cylinder(shaftR + 0.15, 5, [0, 0, z - 1]),
      cylinder(1.25, 5, [reach, 0, z - 1]),
    );
    parts.push({
      shape: horn,
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
    const transformed = new Group();
    transformed.name = item.label;
    transformed.add(component(item.shape, item.label, item.color, [0, 0, 0]));
    transformed.rotation.z = (item.angle * Math.PI) / 180;
    transformed.position.set(...item.shift);
    group.add(transformed);
  }
  return group;
}
export function dimensions(p: Parameters, state: string): [number, number, number] {
  const model = geometry(p, state);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3());
  model.traverse((object) => {
    if ('geometry' in object) (object as import('three').Mesh).geometry.dispose();
    if ('material' in object) {
      const material = (object as import('three').Mesh).material;
      (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
    }
  });
  return size.toArray() as [number, number, number];
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
