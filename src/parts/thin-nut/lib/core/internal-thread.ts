import modeling from '@jscad/modeling';
import { Float32BufferAttribute, Vector3 } from 'three';
import { numberParameter, num } from '../../../../core/geometry';
import { selectParameter } from './fasteners';
import { BoundaryMesh } from '../../../../core/mechanical';
import { outline, type ShellSection } from './hardware';
import type { Parameters } from '../../../../core/types';

const TAU = Math.PI * 2;
const DEPTH = (5 * Math.sqrt(3)) / 16;

/** ISO metric coarse pitches; nonstandard diameters use the next larger preferred size. */
const COARSE_PITCH: [number, number][] = [
  [1, 0.25],
  [1.2, 0.25],
  [1.4, 0.3],
  [1.6, 0.35],
  [1.8, 0.35],
  [2, 0.4],
  [2.5, 0.45],
  [3, 0.5],
  [3.5, 0.6],
  [4, 0.7],
  [5, 0.8],
  [6, 1],
  [7, 1],
  [8, 1.25],
  [10, 1.5],
  [12, 1.75],
  [14, 2],
  [16, 2],
  [18, 2.5],
  [20, 2.5],
  [22, 2.5],
  [24, 3],
  [27, 3],
  [30, 3.5],
  [33, 3.5],
  [36, 4],
  [39, 4],
  [42, 4.5],
  [45, 4.5],
  [48, 5],
  [52, 5],
  [56, 5.5],
  [60, 5.5],
  [64, 6],
  [68, 6],
  [72, 6],
  [76, 6],
  [80, 6],
  [85, 6],
  [90, 6],
  [95, 6],
  [100, 6],
  [110, 6],
  [120, 6],
  [130, 6],
  [140, 6],
  [150, 6],
  [160, 6],
];

export function nutCoarsePitch(diameter: number): number {
  return (COARSE_PITCH.find(([d]) => d >= diameter) ?? COARSE_PITCH.at(-1)!)[1];
}

export const internalThreadParameters = [
  selectParameter('threadMode', 'Thread geometry', 'Thread', [
    ['modeled', 'Modeled helical thread'],
    ['envelope', 'Smooth nominal envelope'],
  ]),
  {
    ...numberParameter('pitch', 'Thread pitch', 'P', 'Thread', 0.1, 12, 0.05),
    description: 'Coarse metric pitch is selected with the diameter. Fine pitches remain editable.',
  },
  {
    ...selectParameter('handedness', 'Thread direction', 'Thread', [
      ['right', 'Right hand'],
      ['left', 'Left hand'],
    ]),
    visibleWhen: (p: Parameters) => p.threadMode === 'modeled',
  },
];

export function internalThreadDefaults(diameter: number): Parameters {
  return { pitch: nutCoarsePitch(diameter), threadMode: 'modeled', handedness: 'right' };
}

export function internalThreadErrors(p: Parameters, diameter: number, height: number): string[] {
  if (p.threadMode !== 'modeled') return [];
  const pitch = Number(p.pitch);
  const errors: string[] = [];
  if (!(pitch > 0) || diameter / 2 - DEPTH * pitch < diameter * 0.12)
    errors.push('Thread pitch must leave a positive internal minor diameter.');
  if (height / pitch > 100)
    errors.push(
      'Modeled internal threads are limited to 100 turns. Increase pitch or use the smooth envelope.',
    );
  return errors;
}

export function internalThreadRadius(
  p: Parameters,
  diameter: number,
  z: number,
  angle: number,
): number {
  if (p.threadMode !== 'modeled') return diameter / 2;
  const pitch = Number(p.pitch);
  const phase = z / pitch - ((p.handedness === 'left' ? -1 : 1) * angle) / TAU;
  const distance = Math.abs(phase - Math.round(phase));
  const groove = Math.max(0, Math.min(1, (3 / 8 - distance) / (5 / 16)));
  return diameter / 2 - DEPTH * pitch * (1 - groove);
}

/** Sample a genuine single-start helical bore while retaining the source outer envelope. */
export function threadedShellMesh(
  sections: ShellSection[],
  p: Parameters,
  diameter: number,
  color?: number,
) {
  const samples: ShellSection[] = [];
  for (let level = 1; level < sections.length; level++) {
    const a = sections[level - 1],
      b = sections[level];
    const count =
      p.threadMode === 'modeled' ? Math.max(1, Math.ceil(((b.z - a.z) / Number(p.pitch)) * 24)) : 1;
    if (level === 1) samples.push(a);
    for (let i = 1; i <= count; i++) {
      const t = i / count;
      samples.push({
        z: a.z + (b.z - a.z) * t,
        bore: a.bore + (b.bore - a.bore) * t,
        outer: a.outer.map((v, j) => v.clone().lerp(b.outer[j], t)),
      });
    }
  }
  const mesh = new BoundaryMesh();
  const outer = samples.map((s) => s.outer.map((v) => new Vector3(v.x, v.y, s.z)));
  const inner = samples.map((s) =>
    outline(1).map((_, i) => {
      const angle = (i * TAU) / 96;
      // The supplied bore envelope encodes the entrance chamfers above the minor diameter.
      const radius = Math.max(s.bore / 2, internalThreadRadius(p, diameter, s.z, angle));
      return new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), s.z);
    }),
  );
  for (let i = 1; i < samples.length; i++) {
    mesh.bridge(outer[i - 1], outer[i]);
    mesh.bridge(inner[i - 1], inner[i], true);
  }
  mesh.face(outer[0], [inner[0]], new Vector3(0, 0, -1));
  mesh.face(outer.at(-1)!, [inner.at(-1)!], new Vector3(0, 0, 1));
  return mesh.build(color);
}

export function internalMinorDiameter(p: Parameters, diameter: number): number {
  return p.threadMode === 'modeled' ? diameter - 2 * DEPTH * Number(p.pitch) : diameter;
}

/** Closed bore cutter for Boolean-built hand nuts, using the same sampled thread surface. */
export function internalThreadCutter(p: Parameters, diameter: number, height: number) {
  const segments = 64;
  const count = p.threadMode === 'modeled' ? Math.ceil(((height + 2) / Number(p.pitch)) * 16) : 1;
  const rings = Array.from({ length: count + 1 }, (_, level) => {
    const z = -1 + ((height + 2) * level) / count;
    return Array.from({ length: segments }, (_, i): [number, number, number] => {
      const angle = (TAU * i) / segments;
      const radius = internalThreadRadius(p, diameter, z, angle);
      return [radius * Math.cos(angle), radius * Math.sin(angle), z];
    });
  });
  const points = rings.flat();
  const faces: number[][] = [];
  for (let j = 1; j <= count; j++)
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      const a = (j - 1) * segments + i,
        b = (j - 1) * segments + next;
      const c = j * segments + i,
        d = j * segments + next;
      faces.push([a, b, c], [b, d, c]);
    }
  faces.push(Array.from({ length: segments }, (_, i) => segments - 1 - i));
  faces.push(Array.from({ length: segments }, (_, i) => count * segments + i));
  return modeling.primitives.polyhedron({ points, faces, orientation: 'outward' });
}

/** Cut the reference 60-degree profile; this is a basic profile without fit allowances. */
export function internalThreadPython(
  p: Parameters,
  diameter: number,
  height: number,
  target = 'shape',
): string {
  if (p.threadMode !== 'modeled') return '';
  const pitch = Number(p.pitch),
    major = diameter / 2,
    minor = internalMinorDiameter(p, diameter) / 2;
  return `# Basic ISO metric internal profile: D1 = D - 5*sqrt(3)*P/8; no fit tolerance.\nnut_pitch = ${num(pitch)}\nnut_major = ${num(major)}\nnut_minor = ${num(minor)}\nnut_overlap = nut_pitch * 0.05\nnut_half_width = nut_pitch * 3/8 + nut_overlap / math.sqrt(3)\nnut_points = [App.Vector(nut_minor-nut_overlap,0,-nut_half_width), App.Vector(nut_major,0,-nut_pitch/16), App.Vector(nut_major,0,nut_pitch/16), App.Vector(nut_minor-nut_overlap,0,nut_half_width)]\nnut_profile = Part.Wire(Part.makePolygon(nut_points + [nut_points[0]]).Edges)\nnut_path = Part.Wire(Part.makeLongHelix(nut_pitch,${num(height + 2 * pitch)},nut_major,0,${p.handedness === 'left' ? 'True' : 'False'}).Edges)\nnut_groove = nut_path.makePipeShell([nut_profile],True,True)\nnut_groove.translate(App.Vector(0,0,-nut_pitch))\n${target} = ${target}.cut(nut_groove)\nif ${target}.isNull() or not ${target}.isValid(): raise ValueError("Internal thread Boolean failed.")`;
}

/** Conform tiny Boolean junctions before Float32 mesh output; the tolerance is 0.2 micrometre. */
export function conformThreadMesh(group: import('three').Group) {
  group.traverse((child) => {
    if (!('isMesh' in child) || !child.isMesh) return;
    const mesh = child as import('three').Mesh;
    const geometry = mesh.geometry;
    const source = geometry.getAttribute('position');
    const indices = geometry.index?.array ?? Array.from({ length: source.count }, (_, i) => i);
    const vertices: Vector3[] = [];
    const cells = new Map<string, number[]>();
    const epsilon = 2e-4;
    const map = Array.from({ length: source.count }, (_, i) => {
      const point = new Vector3().fromBufferAttribute(source, i);
      const grid = point.toArray().map((v) => Math.floor(v / epsilon));
      for (let x = -1; x <= 1; x++)
        for (let y = -1; y <= 1; y++)
          for (let z = -1; z <= 1; z++) {
            const found = cells
              .get([grid[0] + x, grid[1] + y, grid[2] + z].join(','))
              ?.find((id) => vertices[id].distanceToSquared(point) < epsilon * epsilon);
            if (found !== undefined) return found;
          }
      const id = vertices.length;
      vertices.push(point);
      const key = grid.join(',');
      cells.set(key, [...(cells.get(key) ?? []), id]);
      return id;
    });
    let triangles: number[][] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [map[indices[i]], map[indices[i + 1]], map[indices[i + 2]]];
      if (new Set(triangle).size === 3) triangles.push(triangle);
    }
    const uniqueFaces = (faces: number[][]) => {
      const unique = new Map<string, { face: number[]; balance: number }>();
      for (const face of faces) {
        if (new Set(face).size !== 3) continue;
        const [a, b, c] = face.map((id) => vertices[id]);
        if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-20) continue;
        const smallest = face.indexOf(Math.min(...face));
        const sign = face[(smallest + 1) % 3] < face[(smallest + 2) % 3] ? 1 : -1;
        const key = [...face].sort((a, b) => a - b).join(':');
        const value = unique.get(key) ?? { face, balance: 0 };
        value.balance += sign;
        unique.set(key, value);
      }
      return [...unique.values()]
        .filter((v) => v.balance !== 0)
        .map(({ face, balance }) => {
          const smallest = face.indexOf(Math.min(...face));
          const sign = face[(smallest + 1) % 3] < face[(smallest + 2) % 3] ? 1 : -1;
          return sign === Math.sign(balance) ? face : [...face].reverse();
        });
    };
    triangles = uniqueFaces(triangles);
    for (let pass = 0; pass < 3; pass++) {
      const edges = new Map<string, { count: number; a: number; b: number }>();
      const key = (a: number, b: number) => [a, b].sort((x, y) => x - y).join(':');
      for (const triangle of triangles)
        for (let i = 0; i < 3; i++) {
          const a = triangle[i],
            b = triangle[(i + 1) % 3],
            id = key(a, b);
          const edge = edges.get(id) ?? { count: 0, a, b };
          edge.count++;
          edges.set(id, edge);
        }
      const open = [...edges.values()].filter((edge) => edge.count !== 2);
      if (!open.length) break;
      const candidates = [...new Set(open.flatMap((edge) => [edge.a, edge.b]))];
      const splits = new Map<string, number[]>();
      for (const edge of open) {
        const start = vertices[edge.a],
          vector = vertices[edge.b].clone().sub(start),
          length = vector.lengthSq();
        const between = candidates
          .filter((id) => id !== edge.a && id !== edge.b)
          .map((id) => {
            const offset = vertices[id].clone().sub(start),
              t = offset.dot(vector) / length;
            return { id, t, distance: offset.addScaledVector(vector, -t).lengthSq() };
          })
          .filter((v) => v.t > 1e-7 && v.t < 1 - 1e-7 && v.distance < epsilon * epsilon)
          .sort((a, b) => a.t - b.t);
        if (between.length)
          splits.set(key(edge.a, edge.b), [edge.a, ...between.map((v) => v.id), edge.b]);
      }
      if (!splits.size) break;
      const next: number[][] = [];
      for (const triangle of triangles) {
        const boundary: number[] = [];
        for (let i = 0; i < 3; i++) {
          const a = triangle[i],
            b = triangle[(i + 1) % 3],
            split = splits.get(key(a, b));
          boundary.push(
            ...(split ? (split[0] === a ? split : [...split].reverse()) : [a, b]).slice(0, -1),
          );
        }
        if (boundary.length === 3) next.push(triangle);
        else {
          const center = triangle
            .reduce((sum, id) => sum.add(vertices[id]), new Vector3())
            .multiplyScalar(1 / 3);
          const id = vertices.length;
          vertices.push(center);
          for (let i = 0; i < boundary.length; i++)
            next.push([id, boundary[i], boundary[(i + 1) % boundary.length]]);
        }
      }
      triangles = uniqueFaces(next);
    }
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(
        vertices.flatMap((v) => v.toArray()),
        3,
      ),
    );
    geometry.setIndex(triangles.flat());
    geometry.computeVertexNormals();
  });
  return group;
}
