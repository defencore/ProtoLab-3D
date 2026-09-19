import modeling from '@jscad/modeling';
import type { Geom2 } from '@jscad/modeling/src/geometries/types';
import { Group, Mesh, Path, Shape as Surface, ShapeGeometry, Vector3 } from 'three';
import { component, type Shape, type Point, type Vec } from './shapes';
import { solidUnionMesh } from '../../../core/solid-union';
export type FusedLayers = {
  kind: 'fusedLayers';
  children: Shape[];
  planes: number[];
  solid: Shape;
};
/** Stitch abutting layers with disjoint or nested footprints on each shared plane.
 * Resolve their interface boundaries without cutting the complete threaded 3D solid.
 * A 1 µm preview weld removes boolean tessellation noise; CAD retains the exact solid.
 */
export function fusedLayersMesh(s: FusedLayers): Group {
  const triangles: Vec[][] = [],
    caps = new Map<number, { up: Geom2[]; down: Geom2[] }>();
  const vertices = new Map<string, Vec[]>();
  const weld = (v: Vec): Vec => {
    const cell = v.map((x) => Math.floor(x / 0.0025));
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const p of vertices.get([cell[0] + x, cell[1] + y, cell[2] + z].join(',')) ?? [])
            if (p.reduce((sum, n, i) => sum + (n - v[i]) ** 2, 0) < 1e-6) return p;
    const key = cell.join(','),
      bucket = vertices.get(key) ?? [];
    bucket.push(v);
    vertices.set(key, bucket);
    return v;
  };
  for (const child of s.children) {
    const model = component(child, 'layer', 0xffffff);
    model.updateMatrixWorld(true);
    const faces = new Map<string, Vec[][]>();
    model.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      const pos = o.geometry.getAttribute('position'),
        idx = o.geometry.index;
      for (let i = 0; i < (idx?.count ?? pos.count); i += 3) {
        const v = [0, 1, 2].map((j) => {
          const p = new Vector3()
            .fromBufferAttribute(pos, idx ? idx.getX(i + j) : i + j)
            .applyMatrix4(o.matrixWorld)
            .toArray() as Vec;
          const plane = s.planes.find((z) => Math.abs(p[2] - z) < 0.001);
          if (plane !== undefined) p[2] = plane;
          return weld(p);
        });
        const z = s.planes.find((z) => v.every((p) => Math.abs(p[2] - z) < 1e-5));
        if (z === undefined) {
          triangles.push(v);
          continue;
        }
        const direction =
          (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
        if (Math.abs(direction) < 1e-10) continue;
        const key = `${z}:${direction > 0 ? 'up' : 'down'}`;
        const a = faces.get(key) ?? [];
        a.push(direction > 0 ? v : [v[0], v[2], v[1]]);
        faces.set(key, a);
      }
      o.geometry.dispose();
    });
    for (const [key, ts] of faces) {
      const edges = new Map<string, { a: Point; b: Point; n: number }>();
      for (const t of ts)
        for (let i = 0; i < 3; i++) {
          const a = t[i].slice(0, 2) as Point,
            b = t[(i + 1) % 3].slice(0, 2) as Point;
          const ak = a.join(','),
            bk = b.join(','),
            k = ak < bk ? ak + '|' + bk : bk + '|' + ak;
          const e = edges.get(k);
          if (e) e.n++;
          else edges.set(k, { a, b, n: 1 });
        }
      const sides = [...edges.values()].filter((e) => e.n === 1).map((e) => [e.a, e.b]);
      const [zs, direction] = key.split(':'),
        z = +zs;
      if (!caps.has(z)) caps.set(z, { up: [], down: [] });
      caps
        .get(z)!
        [direction as 'up' | 'down'].push(
          modeling.geometries.geom2.create(sides as [Point, Point][]),
        );
    }
  }
  const area = (p: Point[]) =>
    p.reduce((v, a, i) => {
      const b = p[(i + 1) % p.length];
      return v + a[0] * b[1] - a[1] * b[0];
    }, 0);
  const inside = (p: Point, loop: Point[]) => {
    let yes = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i],
        b = loop[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        yes = !yes;
    }
    return yes;
  };
  const emit = (sides: Point[][], z: number) => {
    const loops = modeling.geometries.geom2.toOutlines(
      modeling.geometries.geom2.create(sides as [Point, Point][]),
    ) as Point[][];
    const parents = loops.map(
      (l, i) =>
        loops
          .map((other, j) => ({ j, size: Math.abs(area(other)) }))
          .filter(({ j, size }) => j !== i && size > Math.abs(area(l)) && inside(l[0], loops[j]))
          .sort((a, b) => a.size - b.size)[0]?.j ?? -1,
    );
    const winding = (i: number): number =>
      i < 0 ? 0 : Math.sign(area(loops[i])) + winding(parents[i]);
    loops.forEach((outer, i) => {
      if (winding(parents[i]) !== 0) return;
      const reverse = winding(i) < 0;
      const shape = new Surface();
      shape.moveTo(...outer[0]);
      outer.slice(1).forEach((p) => shape.lineTo(...p));
      shape.closePath();
      loops.forEach((hole, j) => {
        if (parents[j] !== i) return;
        const path = new Path();
        path.moveTo(...hole[0]);
        hole.slice(1).forEach((p) => path.lineTo(...p));
        path.closePath();
        shape.holes.push(path);
      });
      const geom = new ShapeGeometry(shape),
        p = geom.getAttribute('position'),
        idx = geom.index!;
      for (let k = 0; k < idx.count; k += 3)
        triangles.push(
          (reverse ? [0, 2, 1] : [0, 1, 2]).map((j) =>
            weld([p.getX(idx.getX(k + j)), p.getY(idx.getX(k + j)), z]),
          ),
        );
      geom.dispose();
    });
  };
  for (const [z, { up, down }] of caps) {
    const sides = [
      ...up.flatMap((g) => modeling.geometries.geom2.toSides(g)),
      ...down.flatMap((g) => modeling.geometries.geom2.toSides(g).map(([a, b]) => [b, a])),
    ] as Point[][];
    const points = [...new Map(sides.flat().map((p) => [p.join(','), p])).values()];
    const edges = new Map<string, { a: Point; b: Point; balance: number }>();
    for (const [a, b] of sides) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = dx * dx + dy * dy;
      const inner = points
        .map((p) => ({ p, t: ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len }))
        .filter(
          ({ p, t }) =>
            t > 1e-6 &&
            t < 1 - 1e-6 &&
            (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2 < 1e-10,
        )
        .sort((a, b) => a.t - b.t)
        .map((v) => v.p);
      const split = [a, ...inner, b];
      for (let j = 0; j < split.length - 1; j++) {
        const a = split[j],
          b = split[j + 1],
          ak = a.join(','),
          bk = b.join(',');
        if (ak === bk) continue;
        const key = ak < bk ? ak + '|' + bk : bk + '|' + ak,
          sign = ak < bk ? 1 : -1;
        const edge = edges.get(key);
        if (edge) edge.balance += sign;
        else edges.set(key, { a: ak < bk ? a : b, b: ak < bk ? b : a, balance: sign });
      }
    }
    const boundary = [...edges.values()]
      .filter((e) => e.balance !== 0)
      .map((e) => (e.balance > 0 ? [e.a, e.b] : [e.b, e.a]));
    if (boundary.length) emit(boundary, z);
  }
  const solid = modeling.geometries.geom3.create(
    triangles.map((t) => modeling.geometries.poly3.create(t)),
  );
  const result = solidUnionMesh(solid, {
    alreadyTriangulated: true,
    minimumTriangleArea: 1e-12,
    edgeTolerance: 0.001,
    preserveOrigin: true,
  });
  return result;
}
