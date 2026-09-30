import { box, cylinder, type Shape, type Vec } from './shapes';
export function outline(kind: string, w: number, h: number, offset = 0): [number, number][] {
  if (kind === 'triangular') {
    const b = w / 2,
      slant = Math.hypot(b, h),
      low = -offset;
    const half = b + (offset * (b + slant)) / h;
    return [
      [-half, low],
      [half, low],
      [0, h + (offset * slant) / b],
    ];
  }
  if (kind === 'round' || kind === 'oval')
    return Array.from({ length: 96 }, (_, i) => {
      const a = (i * Math.PI) / 48,
        ny = Math.cos(a) / (w / 2),
        nz = Math.sin(a) / (h / 2),
        n = Math.hypot(ny, nz);
      return [
        (w / 2) * Math.cos(a) + (offset * ny) / n,
        h / 2 + (h / 2) * Math.sin(a) + (offset * nz) / n,
      ];
    });
  return [
    [-w / 2 - offset, -offset],
    [w / 2 + offset, -offset],
    [w / 2 + offset, h + offset],
    [-w / 2 - offset, h + offset],
  ];
}
export function extrudedSection(
  kind: string,
  w: number,
  h: number,
  length: number,
  x: number,
  z: number,
  offset = 0,
): Shape {
  if (kind === 'round') return cylinder(w / 2 + offset, length, [x, 0, z + h / 2], 'x');
  if (kind === 'square' || kind === 'rectangular' || kind === 'custom')
    return box([length, w + 2 * offset, h + 2 * offset], [x, -w / 2 - offset, z - offset]);
  const points = outline(kind, w, h, offset);
  return {
    kind: 'loft',
    rings: [x, x + length].map((xx) => points.map(([y, zz]) => [xx, y, z + zz] as Vec)),
  };
}
export function tubeSection(
  kind: string,
  w: number,
  h: number,
  wall: number,
  length: number,
  x: number,
  z: number,
): Shape {
  return {
    kind: 'subtract',
    children: [
      extrudedSection(kind, w, h, length, x, z),
      extrudedSection(kind, w, h, length + 2, x - 1, z, -wall),
    ],
  };
}
export function sectionArea(kind: string, w: number, h: number, wall: number) {
  const area = (pts: [number, number][]) =>
    Math.abs(
      pts.reduce((a, p, i) => {
        const q = pts[(i + 1) % pts.length];
        return a + p[0] * q[1] - q[0] * p[1];
      }, 0),
    ) / 2;
  return area(outline(kind, w, h)) - area(outline(kind, w, h, -wall));
}
