import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { material } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
const TAU = 2 * Math.PI;
export function values(p: Parameters, state: string) {
  const pitch = p.pitchUnit === 'tpi' ? 25.4 / Number(p.tpi) : Number(p.pitch);
  const internal = state === 'internal';
  const trapezoid = p.family === 'tr' || p.family === 'acme';
  const angle =
    p.family === 'custom'
      ? Number(p.angle)
      : p.family === 'tr'
        ? 30
        : p.family === 'acme'
          ? 29
          : 60;
  const depth =
    p.family === 'custom'
      ? Number(p.depth)
      : trapezoid
        ? pitch / 2
        : (internal ? (5 * Math.sqrt(3)) / 16 : (17 * Math.sqrt(3)) / 48) * pitch;
  const crest =
    p.family === 'custom'
      ? Number(p.crest) * pitch
      : trapezoid
        ? pitch * (0.5 - 0.5 * Math.tan((angle * Math.PI) / 360))
        : pitch / 8;
  const flank = depth * Math.tan((angle * Math.PI) / 360);
  const major = Number(p.diameter) / 2 + (internal ? 1 : -1) * Number(p.clearance);
  return {
    pitch,
    internal,
    angle,
    depth,
    crest,
    flank,
    major,
    root: major - depth,
    base: crest + 2 * flank,
    length: Number(p.length),
    starts: Number(p.starts),
    hand: p.handedness === 'left' ? -1 : 1,
    lead: pitch * Number(p.starts),
  };
}
export function radiusAt(p: Parameters, state: string, z: number, angle: number) {
  const v = values(p, state);
  const phase = z / v.pitch - (v.hand * v.starts * angle) / TAU;
  const distance = Math.abs(phase - Math.round(phase)) * v.pitch;
  return (
    v.major -
    Math.max(0, Math.min(v.depth, (distance - v.crest / 2) / Math.tan((v.angle * Math.PI) / 360)))
  );
}
export function errors(p: Parameters, state: string): string[] {
  const v = values(p, state),
    result: string[] = [];
  if (!['external', 'internal'].includes(state))
    result.push('Select External Union or Internal Cut.');
  if (!Object.values(v).every((x) => typeof x === 'boolean' || Number.isFinite(x)))
    result.push('Thread dimensions must be finite.');
  if (v.root <= 0.05) result.push('Pitch, depth or fit adjustment leaves no positive core.');
  if (v.base >= v.pitch * 0.98)
    result.push('Thread flanks overlap: reduce profile depth, crest width or flank angle.');
  if (v.length < v.pitch) result.push('Tool length must be at least one axial pitch.');
  if (v.length / v.pitch > 80)
    result.push('Limit: 80 axial pitches. Shorten the tool or increase pitch.');
  if (!Number.isInteger(v.starts) || v.starts < 1 || v.starts > 4)
    result.push('Choose 1–4 whole thread starts.');
  return result;
}
export function geometry(p: Parameters, state: string): Group {
  const v = values(p, state);
  // Indexed closed radial surface. 96 angular segments and >=48 axial samples/pitch
  // keep both ends planar while matching the analytical helical cut in FreeCAD.
  const segments = 96,
    levels = Math.ceil((v.length / v.pitch) * 48);
  const positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= levels; j++)
    for (let i = 0; i < segments; i++) {
      const z = (v.length * j) / levels,
        a = (TAU * i) / segments,
        r = radiusAt(p, state, z, a);
      positions.push(r * Math.cos(a), r * Math.sin(a), z);
    }
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < segments; i++) {
      const a = j * segments + i,
        b = j * segments + ((i + 1) % segments),
        c = a + segments,
        d = b + segments;
      indices.push(a, b, c, b, d, c);
    }
  const bottom = positions.length / 3;
  positions.push(0, 0, 0);
  const top = positions.length / 3;
  positions.push(0, 0, v.length);
  for (let i = 0; i < segments; i++) {
    const n = (i + 1) % segments;
    indices.push(bottom, n, i, top, levels * segments + i, levels * segments + n);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const mesh = new Mesh(g, material(v.internal ? 0xd9a565 : 0x9faebd));
  mesh.name = v.internal
    ? 'Internal thread · subtract this solid'
    : 'External thread · fuse this solid';
  return new Group().add(mesh);
}
export function python(p: Parameters, state: string): string {
  const v = values(p, state);
  // Preserve double precision for inch conversions and fine pitches.
  const f = (n: number) => String(n);
  const halfRoot = (v.pitch - v.base) / 2;
  const overlap = v.pitch * 0.08;
  const halfOuter = (v.pitch - v.crest) / 2 + overlap * Math.tan((v.angle * Math.PI) / 360);
  return `# Boolean tool: ${v.internal ? 'INTERNAL thread — Part Cut (base first, this tool second)' : 'EXTERNAL thread — Part Union with an overlapping base'}
# One closed solid; no automatic modification of existing objects.
# Z=0 is the lower end; helix axis is +Z. Length=${f(v.length)} mm.
thread_pitch = ${f(v.pitch)}
thread_lead = ${f(v.lead)}
thread_major = ${f(v.major)}
thread_root = ${f(v.root)}
thread_length = ${f(v.length)}
shape = Part.makeCylinder(thread_major, thread_length)
profile_points = [App.Vector(thread_root,0,${f(-halfRoot)}), App.Vector(thread_major+${f(overlap)},0,${f(-halfOuter)}), App.Vector(thread_major+${f(overlap)},0,${f(halfOuter)}), App.Vector(thread_root,0,${f(halfRoot)})]
profile = Part.Wire(Part.makePolygon(profile_points+[profile_points[0]]).Edges)
path = Part.Wire(Part.makeLongHelix(thread_lead, thread_length+2*thread_lead, thread_root, 0, ${v.hand < 0 ? 'True' : 'False'}).Edges)
groove = path.makePipeShell([profile],True,True)
# OCC may return an inward-oriented swept solid for some lead/profile ratios.
# Normalize it before Boolean subtraction instead of treating its complement as a tool.
if groove.Volume < 0:
    groove.reverse()
for start in range(${v.starts}):
    tool = groove.copy()
    tool.translate(App.Vector(0,0,-thread_lead+(start+0.5)*thread_pitch))
    shape = shape.cut(tool)
# Preserve sweep patch boundaries. Refining these faces can create an
# unorientable result in a subsequent Part Cut despite a valid tool itself.
if shape.isNull() or not shape.isValid() or len(shape.Solids)!=1 or not shape.isClosed():
    raise ValueError("Thread Boolean tool must be one valid closed solid.")`;
}
