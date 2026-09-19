import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Path,
  Shape as Surface,
  ShapeGeometry,
} from 'three';
import type { Point, Shape } from './shapes';
import type { Thread } from './thread';
export type ThreadedPlate = {
  kind: 'threadedPlate';
  plate: Extract<Shape, { kind: 'plate' }>;
  holes: (Thread & { x: number; y: number; z: number })[];
};
/** Through threads are meshed directly, avoiding a whole-disk CSG split for every helix. */
export function threadedPlateMesh(s: ThreadedPlate): Group {
  const positions: number[] = [];
  const segments = 48,
    samples = 12,
    base = s.plate;
  const radius = (t: ThreadedPlate['holes'][number], z: number, i: number) => {
    const phase = (z - t.z) / t.pitch - i / segments;
    const d = Math.abs(phase - Math.round(phase)) * t.pitch;
    const depth = t.pitch * Math.sqrt(3) * (t.internal ? 5 / 16 : 17 / 48);
    return (
      t.diameter / 2 + t.clearance - Math.max(0, Math.min(depth, (d - t.pitch / 16) * Math.sqrt(3)))
    );
  };
  const threadOutline = (t: ThreadedPlate['holes'][number], z: number): Point[] =>
    Array.from({ length: segments }, (_, i) => {
      const a = (2 * Math.PI * i) / segments,
        r = radius(t, z, i);
      return [t.x + r * Math.cos(a), t.y + r * Math.sin(a)];
    });
  const cap = (z: number, reverse: boolean) => {
    const shape = new Surface();
    shape.moveTo(...base.outline[0]);
    base.outline.slice(1).forEach((p) => shape.lineTo(...p));
    shape.closePath();
    for (const points of [...base.holes, ...s.holes.map((t) => threadOutline(t, z))]) {
      const hole = new Path();
      hole.moveTo(...points[0]);
      points.slice(1).forEach((p) => hole.lineTo(...p));
      hole.closePath();
      shape.holes.push(hole);
    }
    const g = new ShapeGeometry(shape),
      p = g.getAttribute('position'),
      idx = g.index!;
    // Earcut may bridge a hole through an existing collinear vertex. Conform
    // just those cap edges so the exported mesh has no T-junctions.
    const vertices: Point[] = [],
      ids = new Map<string, number>(),
      remap: number[] = [];
    for (let i = 0; i < p.count; i++) {
      const v: Point = [p.getX(i), p.getY(i)],
        key = v.join(',');
      if (!ids.has(key)) {
        ids.set(key, vertices.length);
        vertices.push(v);
      }
      remap.push(ids.get(key)!);
    }
    const triangles: number[][] = [],
      edges = new Map<string, number>();
    const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    for (let i = 0; i < idx.count; i += 3) {
      const tri = [0, 1, 2].map((j) => remap[idx.getX(i + j)]);
      triangles.push(tri);
      for (let j = 0; j < 3; j++) {
        const key = edgeKey(tri[j], tri[(j + 1) % 3]);
        edges.set(key, (edges.get(key) ?? 0) + 1);
      }
    }
    const open = [...edges].filter(([, n]) => n === 1).map(([key]) => key.split(':').map(Number));
    const candidates = [...new Set(open.flat())],
      refinements = new Map<string, number[]>();
    for (const [a, b] of open) {
      const [ax, ay] = vertices[a],
        [bx, by] = vertices[b],
        dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy;
      const points = candidates
        .filter((i) => i !== a && i !== b)
        .map((i) => {
          const [x, y] = vertices[i],
            t = ((x - ax) * dx + (y - ay) * dy) / l2;
          return { i, t, d2: (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 };
        })
        .filter((v) => v.t > 1e-7 && v.t < 1 - 1e-7 && v.d2 < 1e-10)
        .sort((a, b) => a.t - b.t);
      if (points.length) refinements.set(edgeKey(a, b), [a, ...points.map((v) => v.i), b]);
    }
    const emit = (tri: Point[]) => {
      for (const j of reverse ? [0, 2, 1] : [0, 1, 2]) positions.push(...tri[j], z);
    };
    for (const tri of triangles) {
      const outline: number[] = [];
      for (let j = 0; j < 3; j++) {
        const a = tri[j],
          b = tri[(j + 1) % 3],
          edge = refinements.get(edgeKey(a, b));
        outline.push(
          ...(edge ? (edge[0] === a ? edge : [...edge].reverse()) : [a, b]).slice(0, -1),
        );
      }
      if (outline.length === 3) emit(tri.map((i) => vertices[i]));
      else {
        const center: Point = [
          tri.reduce((v, i) => v + vertices[i][0], 0) / 3,
          tri.reduce((v, i) => v + vertices[i][1], 0) / 3,
        ];
        for (let j = 0; j < outline.length; j++)
          emit([center, vertices[outline[j]], vertices[outline[(j + 1) % outline.length]]]);
      }
    }
    g.dispose();
  };
  const wall = (low: Point[], high: Point[], z0: number, z1: number, inward: boolean) => {
    for (let i = 0; i < low.length; i++) {
      const j = (i + 1) % low.length;
      const v = [
        [...low[i], z0],
        [...low[j], z0],
        [...high[i], z1],
        [...high[j], z1],
      ];
      for (const k of inward ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2]) positions.push(...v[k]);
    }
  };
  cap(base.z, true);
  cap(base.z + base.height, false);
  wall(base.outline, base.outline, base.z, base.z + base.height, false);
  base.holes.forEach((h) => wall(h, h, base.z, base.z + base.height, true));
  for (const t of s.holes) {
    const n = Math.ceil((base.height / t.pitch) * samples);
    for (let j = 0; j < n; j++) {
      const z0 = base.z + (base.height * j) / n,
        z1 = base.z + (base.height * (j + 1)) / n;
      wall(threadOutline(t, z0), threadOutline(t, z1), z0, z1, true);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return new Group().add(new Mesh(geometry, new MeshStandardMaterial()));
}
