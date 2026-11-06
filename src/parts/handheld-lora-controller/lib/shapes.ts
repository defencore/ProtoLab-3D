import { ShapeUtils, Vector2 } from 'three';
import {
  box,
  cylinder,
  prism,
  union,
  subtract,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
export const B = (w: number, l: number, h: number, x = 0, y = 0, z = 0): Shape =>
  box([w, l, h], [x - w / 2, y - l / 2, z]);
export const C = (d: number, h: number, z = 0, x = 0, y = 0): Shape =>
  cylinder(d / 2, h, [x, y, z]);
export { union, subtract };
export const move = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
export function outline(w: number, l: number, r: number, cx = 0, cy = 0): [number, number][] {
  return [0, 1, 2, 3].flatMap((corner) => {
    const x = cx + (corner === 0 || corner === 3 ? 1 : -1) * (w / 2 - r),
      y = cy + (corner < 2 ? 1 : -1) * (l / 2 - r);
    return Array.from({ length: 9 }, (_, i): [number, number] => {
      const a = ((corner * 90 + (i * 90) / 8) * Math.PI) / 180;
      return [x + r * Math.cos(a), y + r * Math.sin(a)];
    });
  });
}
export const rounded = (
  w: number,
  l: number,
  r: number,
  z: number,
  h: number,
  x = 0,
  y = 0,
): Shape => prism(outline(w, l, r, x, y), h, z);
export const hex = (af: number, z: number, h: number, x: number, y: number): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const a = ((30 + i * 60) * Math.PI) / 180;
      return [x + (af / Math.sqrt(3)) * Math.cos(a), y + (af / Math.sqrt(3)) * Math.sin(a)];
    }),
    h,
    z,
  );
/** Smooth local stock around the tail fastener; the overall case width stays unchanged. */
function tailStock(y: number): number {
  const ease = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));
  if (y <= -53 || y >= -31) return 0;
  if (y < -47) return 2.25 * ease((y + 53) / 6);
  if (y <= -40) return 2.25;
  return 2.25 * (1 - ease((y + 40) / 9));
}

/** Right-hand grip with a continuous tail shoulder and preserved outward winding. */
export function caseOutline(inset = 0, palmStations = false): [number, number][] {
  const tangent = Math.atan2(80, 4) - Math.acos(-2 / Math.hypot(80, 4));
  const arcs = [
    [7, 39, 14 - inset, tangent, Math.PI / 2],
    [-7, 39, 14 - inset, Math.PI / 2, Math.PI],
    [-9, -41, 12 - inset, Math.PI, Math.PI * 1.5],
    [3, -41, 12 - inset, Math.PI * 1.5, Math.PI * 2 + tangent],
  ];
  const points = arcs
    .flatMap(([x, y, r, start, end]) =>
      Array.from({ length: 17 }, (_, i): [number, number] => {
        const angle = start + ((end - start) * i) / 16;
        return [-x - r * Math.cos(angle), y + r * Math.sin(angle)];
      }),
    )
    .reverse();
  return points
    .flatMap((point, i): [number, number][] => {
      const next = points[(i + 1) % points.length];
      if (point[0] >= 0 || next[0] >= 0 || Math.abs(next[1] - point[1]) < 30) return [point];
      // Resolve the shoulder fade on the long palm edge. All inset layers use
      // matching stations, including the seam and the chamfered lid exterior.
      const headStations = Array.from({ length: 10 }, (_, j) => -40 + j).map((y) => ({
          y,
          t: (y - point[1]) / (next[1] - point[1]),
        })),
        originalPalmStations = palmStations
          ? Array.from({ length: 80 }, (_, j) => {
              const t = (j + 1) / 81;
              return { t, y: point[1] + t * (next[1] - point[1]) };
            })
          : [];
      const stations = [...headStations, ...originalPalmStations]
        .filter(({ t }) => t > 0 && t < 1)
        .sort((a, b) => a.t - b.t)
        .map(({ y, t }): [number, number] => [point[0] + t * (next[0] - point[0]), y]);
      return [point, ...stations];
    })
    .map(([x, y]): [number, number] => [x < 0 ? x - tailStock(y) : x, y]);
}
export const casePrism = (inset: number, z: number, h: number): Shape =>
  prism(caseOutline(inset), h, z);
export function shellLoft(layers: [number, number][]): Shape {
  const rings = layers.map(([z, inset]) => caseOutline(inset).map(([x, y]): Vec => [x, y, z])),
    stride = rings[0].length,
    points = rings.flat(),
    faces: number[][] = [];
  for (let layer = 0; layer + 1 < rings.length; layer++)
    for (let i = 0; i < stride; i++) {
      const a = layer * stride + i,
        b = layer * stride + ((i + 1) % stride);
      faces.push([a, b, b + stride], [a, b + stride, a + stride]);
    }
  // The tail shoulder is concave. Explicit cap triangles keep Boolean solids
  // faithful to that outline in both the preview and native CAD exporter.
  for (const [layer, top] of [
    [0, false],
    [rings.length - 1, true],
  ] as const)
    for (const triangle of ShapeUtils.triangulateShape(
      rings[layer].map(([x, y]) => new Vector2(x, y)),
      [],
    )) {
      const face = triangle.map((i) => layer * stride + i),
        [a, b, c] = face.map((i) => points[i]),
        positive = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
      faces.push(positive === top ? face : face.reverse());
    }
  return { kind: 'boundary', points, faces };
}
