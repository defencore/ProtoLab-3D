import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { material } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import models from './models.json';
export function model(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Unknown CO₂ cartridge');
  return m;
}
export function dimensions(p: Parameters) {
  const m = model(p),
    r = m.diameter / 2,
    neck = m.neckDiameter / 2,
    neckBase = m.length - m.neckLength;
  const pitch = m.tpi ? 25.4 / m.tpi : 0;
  return {
    m,
    r,
    neck,
    neckBase,
    shoulder: neckBase - (r - neck) * 1.6,
    pitch,
    start: neckBase + pitch * 0.6,
    end: m.length - pitch * 0.7,
    chamfer: 0.2,
    recess: 0.12,
  };
}
export function threadRadius(p: Parameters, z: number, angle: number) {
  const v = dimensions(p),
    depth = ((17 * Math.sqrt(3)) / 48) * v.pitch;
  const phase = (z - v.start) / v.pitch - angle / (2 * Math.PI);
  const distance = Math.abs(phase - Math.round(phase)) * v.pitch;
  return v.neck - Math.max(0, Math.min(depth, (distance - v.pitch / 16) / Math.tan(Math.PI / 6)));
}
export function geometry(p: Parameters): Group {
  const v = dimensions(p),
    rings: { r: number; z: number; thread?: boolean }[] = [];
  // Reconstructed hemispherical base and cubic shoulder, with source A/B/C/D fixed.
  rings.push({ r: 0, z: 0 });
  for (let i = 1; i <= 32; i++) {
    const t = (i * Math.PI) / 64;
    rings.push({ r: v.r * Math.sin(t), z: v.r * (1 - Math.cos(t)) });
  }
  rings.push({ r: v.r, z: v.shoulder });
  for (let i = 1; i <= 32; i++) {
    const t = i / 32,
      s = t * t * (3 - 2 * t);
    rings.push({ r: v.r + (v.neck - v.r) * s, z: v.shoulder + (v.neckBase - v.shoulder) * t });
  }
  if (v.pitch) {
    rings.push({ r: v.neck, z: v.start });
    const levels = Math.ceil(((v.end - v.start) / v.pitch) * 48);
    for (let i = 0; i <= levels; i++)
      rings.push({ r: v.neck, z: v.start + ((v.end - v.start) * i) / levels, thread: true });
    rings.push({ r: v.neck, z: v.end });
  }
  rings.push(
    { r: v.neck, z: v.m.length - v.chamfer },
    { r: v.neck - v.chamfer, z: v.m.length },
    { r: v.neck * 0.65, z: v.m.length },
    { r: v.neck * 0.65, z: v.m.length - v.recess },
    { r: 0, z: v.m.length - v.recess },
  );
  const segments = 128,
    positions: number[] = [],
    indices: number[] = [],
    vertices = new Map<string, number>();
  const ringIndices = rings.map((ring) =>
    Array.from({ length: segments }, (_, i) => {
      const a = (i * 2 * Math.PI) / segments,
        r = ring.thread ? threadRadius(p, ring.z, a) : ring.r;
      const xyz = [r * Math.cos(a), r * Math.sin(a), ring.z];
      const key = xyz.map((v) => Math.round(v * 1e8)).join(',');
      const existing = vertices.get(key);
      if (existing !== undefined) return existing;
      const id = positions.length / 3;
      positions.push(...xyz);
      vertices.set(key, id);
      return id;
    }),
  );
  const add = (a: number, b: number, c: number) => {
    if (a === b || b === c || a === c) return;
    const va = new Vector3().fromArray(positions, a * 3),
      vb = new Vector3().fromArray(positions, b * 3),
      vc = new Vector3().fromArray(positions, c * 3);
    if (vb.sub(va).cross(vc.sub(va)).lengthSq() < 1e-18) return;
    indices.push(a, b, c);
  };
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments,
        a = ringIndices[j][i],
        b = ringIndices[j][n],
        c = ringIndices[j + 1][i],
        d = ringIndices[j + 1][n];
      add(a, b, c);
      add(b, d, c);
    }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const mesh = new Mesh(g, material(0xb9c2c9));
  mesh.name = v.m.name;
  return new Group().add(mesh);
}
export function python(p: Parameters): string {
  const v = dimensions(p),
    n = (x: number) => String(x);
  const point = (r: number, z: number) => `App.Vector(${n(r)},0,${n(z)})`;
  const shoulderHeight = v.neckBase - v.shoulder;
  const points = [
    [v.neck, v.neckBase],
    [v.neck, v.m.length - v.chamfer],
    [v.neck - v.chamfer, v.m.length],
    [v.neck * 0.65, v.m.length],
    [v.neck * 0.65, v.m.length - v.recess],
    [0, v.m.length - v.recess],
    [0, 0],
  ];
  const lines = [
    `# Leland ${v.m.sku}: ${v.m.gasMass} g CO2 fill. Solid external representation.`,
    `# Source A/B/C/D: ${Object.values(v.m.sourceInches).join(' / ')} in; rounded details reconstructed.`,
    `edges = [Part.Arc(${point(0, 0)},${point(v.r / Math.sqrt(2), v.r * (1 - 1 / Math.sqrt(2)))},${point(v.r, v.r)}).toShape(), Part.makeLine(${point(v.r, v.r)},${point(v.r, v.shoulder)})]`,
    'shoulder = Part.BezierCurve()',
    `shoulder.setPoles([${point(v.r, v.shoulder)},${point(v.r, v.shoulder + shoulderHeight / 3)},${point(v.neck, v.shoulder + (2 * shoulderHeight) / 3)},${point(v.neck, v.neckBase)}])`,
    'edges.append(shoulder.toShape())',
    ...points
      .slice(1)
      .map(
        (pt, i) =>
          `edges.append(Part.makeLine(${point(...(points[i] as [number, number]))},${point(...(pt as [number, number]))}))`,
      ),
    'shape = Part.Face(Part.Wire(edges)).revolve(App.Vector(0,0,0),App.Vector(0,0,1),360)',
  ];
  if (v.pitch) {
    const root = v.neck - ((17 * Math.sqrt(3)) / 48) * v.pitch;
    const halfRoot = v.pitch / 12,
      overlap = 0.08 * v.pitch,
      halfOuter = (7 * v.pitch) / 16 + overlap * Math.tan(Math.PI / 6);
    lines.push(
      `# Nominal ${v.m.connection}; coverage and terminal collars are reconstructed.`,
      `profile_points=[${point(root, -halfRoot)},${point(v.neck + overlap, -halfOuter)},${point(v.neck + overlap, halfOuter)},${point(root, halfRoot)}]`,
      'profile=Part.Wire(Part.makePolygon(profile_points+[profile_points[0]]).Edges)',
      `path=Part.Wire(Part.makeLongHelix(${n(v.pitch)},${n(v.end - v.start + 2 * v.pitch)},${n(root)},0,False).Edges)`,
      'groove=path.makePipeShell([profile],True,True)',
      'if groove.Volume < 0: groove.reverse()',
      `groove.translate(App.Vector(0,0,${n(v.start - v.pitch / 2)}))`,
      `band=Part.makeCylinder(${n(v.neck + overlap * 2)},${n(v.end - v.start)},App.Vector(0,0,${n(v.start)}))`,
      'shape=shape.cut(groove.common(band))',
      '# Preserve sweep patches: refinement can harm subsequent CAD Booleans.',
    );
  }
  lines.push(
    'if shape.isNull() or not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1:',
    '    raise ValueError("CO2 cartridge must be one valid closed external solid.")',
  );
  return lines.join('\n');
}
