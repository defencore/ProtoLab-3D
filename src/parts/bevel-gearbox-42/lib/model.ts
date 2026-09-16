import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Box3, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import housing from './housing.json';
import { type Shape, type Vec } from './shapes';
import { C, cut, union, ring, rotate, move, arcBand } from './helpers';
import { profile } from './gears';
import * as assembly from './assembly';
import type { Piece } from './assembly';

const steel = 0x41454a,
  bearingSteel = 0xa8afb8;
/** Radial representation of the four purchased shaft interface families. */
function boreRadius(angle: number, p: Parameters) {
  const r = Number(p.bore) / 2,
    c = Math.cos(angle),
    s = Math.abs(Math.sin(angle));
  if (p.socket === 'd') return c > 0 ? Math.min(r, (r - 1) / c) : r;
  if (p.socket === 'hex')
    return (
      r /
      Math.cos(
        ((((angle + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6,
      )
    );
  const w = Number(p.bore) === 8 ? 3 : 4,
    depth = Number(p.bore) === 8 ? 1.5 : 1;
  if (c <= 0) return r;
  if (p.socket === 'keyway')
    return Math.max(r, Math.min((r + depth) / c, w / 2 / Math.max(s, 1e-9)));
  // A tongue occupies part of the otherwise round hole.
  if (p.socket === 'tongue' && ((r - depth) * s) / c <= w / 2) return Math.min(r, (r - depth) / c);
  return r;
}
function gear(p: Parameters, hand: number): Shape {
  const outline = profile(1, 20),
    N = outline.length;
  const sweep = ((Number(p.sweep) * Math.PI) / 180) * hand;
  // Stations include both actual retaining groove shoulders and the bearing journal.
  const stations: [number, number, number][] = [
    [6, -5.9, sweep],
    [7.5, 0.75, sweep],
    [10, 1, 0],
    [10.05, -8.65, 0],
    [12.85, -8.65, 0],
    [12.85, -7.5, 0],
    [17.9, -7.5, 0],
    [17.9, -7.15, 0],
    [19, -7.15, 0],
    [19, -7.5, 0],
    [21, -7.5, 0],
  ];
  const points: Vec[] = [],
    faces: number[][] = [];
  for (const [z, scale, twist] of stations)
    for (let i = 0; i < N; i++) {
      const [x, y] = outline[i],
        a = Math.atan2(y, x) + twist,
        r = scale < 0 ? -scale : Math.hypot(x, y) * scale;
      points.push([r * Math.cos(a), r * Math.sin(a), z]);
    }
  // Identical bore contour at both ends, independent of gear spiral sweep.
  const innerStart = points.length;
  for (const z of [6, 7.5, 21])
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N - Math.PI / 20,
        r = z === 6 && p.socket === 'keyway' ? Number(p.bore) / 2 : boreRadius(a, p);
      points.push([r * Math.cos(a), r * Math.sin(a), z]);
    }
  const triangle = (a: number, b: number, c: number) => {
    const ab = new Vector3(...points[b]).sub(new Vector3(...points[a]));
    const ac = new Vector3(...points[c]).sub(new Vector3(...points[a]));
    if (ab.cross(ac).lengthSq() > 1e-16) faces.push([a, b, c]);
  };
  const quad = (a: number, b: number, c: number, d: number) => {
    triangle(a, b, c);
    triangle(a, c, d);
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let k = 0; k < stations.length - 1; k++)
      quad(k * N + i, k * N + j, (k + 1) * N + j, (k + 1) * N + i);
    for (let k = 0; k < 2; k++)
      quad(
        innerStart + k * N + j,
        innerStart + k * N + i,
        innerStart + (k + 1) * N + i,
        innerStart + (k + 1) * N + j,
      );
    quad(j, i, innerStart + i, innerStart + j);
    const top = (stations.length - 1) * N;
    quad(top + i, top + j, innerStart + 2 * N + j, innerStart + 2 * N + i);
  }
  return { kind: 'boundary', points, faces };
}
function circlip(internal: boolean): Shape {
  const outer = internal ? 12.58 : 9.35,
    inner = internal ? 10 : 7.17;
  const a = (25 * Math.PI) / 180,
    cx = (internal ? 11 : 8.05) * Math.cos(a),
    cy = (internal ? 11 : 8.05) * Math.sin(a);
  const ear = internal ? 1.55 : 1.65,
    hole = internal ? 2 : 1.7,
    t = internal ? 1.2 : 1;
  const clip = cut(
    union(
      arcBand(inner, outer - inner, t, 25, 335, 17.95),
      C(ear * 2, t, 17.95, cx, cy),
      C(ear * 2, t, 17.95, cx, -cy),
    ),
    C(hole, t + 2, 16.95, cx, cy),
    C(hole, t + 2, 16.95, cx, -cy),
  );
  return rotate(
    internal ? clip : cut(clip, C(inner * 2, t + 2, 16.95), ring(40, 18.8, t + 2, 16.95)),
    0,
    0,
    internal ? 180 : 0,
  );
}
export function pieces(p: Parameters, state: string): Piece[] {
  if (state === 'housing') return [];
  const out: Piece[] = [];
  const ports =
    p.layout === 'three' ? ['Input X', 'Output +Z', 'Output −Z'] : ['Input X', 'Output +Z'];
  const pose = (s: Shape, index: number, spin: number, offset = 0) => {
    s = move(rotate(s, 0, 0, spin), 0, 0, offset);
    return index === 0 ? rotate(s, 0, 90) : index === 2 ? rotate(s, 0, 180) : s;
  };
  ports.forEach((port, index) => {
    const phase = index === 0 ? Number(p.inputAngle) : -Number(p.inputAngle) + 9;
    const add = (label: string, s: Shape, color: number, spin = 0, extra = 0) =>
      out.push({
        label: `${port} · ${label}`,
        shape: pose(s, index, spin, state === 'exploded' ? 24 + extra : 0),
        color,
      });
    add('Spiral bevel gear · M1 · 20T', gear(p, index === 0 ? 1 : -1), steel, phase);
    // Purchased sealed bearing is kept as one lightweight cartridge with machined face reliefs.
    const cartridge = cut(
      ring(24, 15, 5, 12.85),
      ring(21, 18, 0.18, 12.84),
      ring(21, 18, 0.18, 17.68),
    );
    add('61802 / 6802 bearing · 15 × 24 × 5', cartridge, bearingSteel, 0, 18);
    add('DIN 471 · shaft circlip · 15 × 1', circlip(false), steel, phase, 30);
    add('DIN 472 · bore circlip · 24 × 1.2', circlip(true), steel, 0, 34);
  });
  return out;
}
function housingMesh() {
  const decode = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(decode(housing.positions)), 3));
  g.setIndex(new BufferAttribute(new Uint32Array(decode(housing.indices)), 1));
  g.computeVertexNormals();
  g.userData.nativeTopology = true;
  const mesh = new Mesh(
    g,
    new MeshStandardMaterial({
      color: 0xb9c1c9,
      metalness: 0.45,
      roughness: 0.45,
      flatShading: true,
    }),
  );
  mesh.name = '42 mm housing · STEP exterior / corrected seats';
  return mesh;
}
export function geometry(p: Parameters, state: string) {
  const group = assembly.geometry(pieces(p, state));
  if (state !== 'internals') group.add(housingMesh());
  return group;
}
export function python(p: Parameters, state: string) {
  const code =
    state === 'housing'
      ? 'components = []\ncomponent_labels = []\ncomponent_colors = []'
      : assembly.python(pieces(p, state));
  if (state === 'internals') return code;
  return (
    code +
    '\nimport base64, zlib\nhousing = Part.Shape()\n' +
    `housing.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(housing.brep)})).decode('utf-8'))\n` +
    `components.append(housing)\ncomponent_labels.append('42 mm housing · STEP exterior / corrected seats')\ncomponent_colors.append((0.725,0.757,0.788))\nshape = Part.makeCompound(components)`
  );
}
export function dimensions(p: Parameters, state: string): Vec {
  const g = geometry(p, state);
  const b = new Box3().setFromObject(g, true).getSize(new Vector3()).toArray() as Vec;
  g.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshStandardMaterial).dispose();
    }
  });
  return b;
}
