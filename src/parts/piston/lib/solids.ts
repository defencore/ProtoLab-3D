import { annularSector } from '../../../core/mechanical';

export type Vec = [number, number, number];
export type Bounds = [Vec, Vec];
export type Solid =
  | { kind: 'cylinder'; radius: number; length: number; center: Vec; axis: 'x' | 'z' }
  | {
      kind: 'sector';
      outer: number;
      inner: number;
      gap: number;
      height: number;
      center: Vec;
      axis: 'x' | 'z';
    }
  | { kind: 'torus'; major: number; minor: number; center: Vec }
  | { kind: 'union'; items: Solid[] }
  | { kind: 'cut'; items: Solid[] }
  | { kind: 'intersection'; items: Solid[] };
export const cylinder = (
  radius: number,
  length: number,
  center: Vec = [0, 0, 0],
  axis: 'x' | 'z' = 'z',
): Solid => ({ kind: 'cylinder', radius, length, center, axis });
export const cut = (...items: Solid[]): Solid => ({ kind: 'cut', items });
export const union = (...items: Solid[]): Solid => ({ kind: 'union', items });
export const intersection = (...items: Solid[]): Solid => ({ kind: 'intersection', items });
export function sectorPoints(s: Extract<Solid, { kind: 'sector' }>) {
  return annularSector(s.outer, s.inner, s.gap, 96).map((v) => [v.x, v.y] as [number, number]);
}
export function solidBounds(s: Solid): Bounds {
  if (s.kind === 'cut') return solidBounds(s.items[0]);
  if (s.kind === 'union' || s.kind === 'intersection') {
    const list = s.items.map(solidBounds),
      join = s.kind === 'union';
    return [
      [0, 1, 2].map((i) => (join ? Math.min : Math.max)(...list.map((b) => b[0][i]))) as Vec,
      [0, 1, 2].map((i) => (join ? Math.max : Math.min)(...list.map((b) => b[1][i]))) as Vec,
    ];
  }
  let offsets: Bounds;
  if (s.kind === 'torus')
    offsets = [
      [-s.major - s.minor, -s.major - s.minor, -s.minor],
      [s.major + s.minor, s.major + s.minor, s.minor],
    ];
  else if (s.kind === 'cylinder') {
    const ext: Vec =
      s.axis === 'x' ? [s.length / 2, s.radius, s.radius] : [s.radius, s.radius, s.length / 2];
    offsets = [ext.map((v) => -v) as Vec, ext];
  } else {
    const points = sectorPoints(s),
      u = points.map((p) => p[0]),
      v = points.map((p) => p[1]);
    offsets =
      s.axis === 'x'
        ? [
            [-s.height / 2, Math.min(...v), -Math.max(...u)],
            [s.height / 2, Math.max(...v), -Math.min(...u)],
          ]
        : [
            [Math.min(...u), Math.min(...v), -s.height / 2],
            [Math.max(...u), Math.max(...v), s.height / 2],
          ];
  }
  return offsets.map((bound) => bound.map((v, i) => v + s.center[i]) as Vec) as Bounds;
}
export interface Component {
  name: string;
  color: number;
  solid: Solid;
  offset: Vec;
}
export function componentBounds(c: Component): Bounds {
  return solidBounds(c.solid).map((bound) => bound.map((v, i) => v + c.offset[i]) as Vec) as Bounds;
}
export function assemblyBounds(components: Component[]): Bounds {
  const all = components.map(componentBounds);
  return [
    [0, 1, 2].map((i) => Math.min(...all.map((b) => b[0][i]))) as Vec,
    [0, 1, 2].map((i) => Math.max(...all.map((b) => b[1][i]))) as Vec,
  ];
}
