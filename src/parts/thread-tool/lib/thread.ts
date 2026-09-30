import { showThreads } from '../../../core/thread-visual';
import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { material } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { threadMetadataPython, type ThreadCallout } from '../../../core/thread-callouts';
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
  const printed = p.manufacturing === 'printed';
  const major = Number(p.diameter) / 2 + (printed ? (internal ? 1 : -1) * Number(p.clearance) : 0);
  return {
    printed,
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
    cap: p.form !== 'tool',
    hex: p.form === 'hex-cap',
    capSize: Number(p.capSize),
    capThickness: Number(p.capThickness),
    bore: p.boreEnabled === true ? Number(p.boreDiameter) / 2 : 0,
  };
}
export function radiusAt(p: Parameters, state: string, z: number, angle: number) {
  const v = values(p, state);
  if (!v.printed) return v.major;
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
  if (v.printed && v.length / v.pitch > 80)
    result.push('Limit: 80 axial pitches. Shorten the tool or increase pitch.');
  if (!Number.isInteger(v.starts) || v.starts < 1 || v.starts > 4)
    result.push('Choose 1–4 whole thread starts.');
  if (v.bore > 0 && v.bore >= v.root - 0.1)
    result.push('Through hole must leave at least 0.1 mm radial material below the thread root.');
  if (v.cap && v.capSize / 2 <= v.major + 0.1)
    result.push(
      'Cap diameter / across flats must exceed the adjusted thread diameter by more than 0.2 mm.',
    );
  return result;
}
export function dimensions(p: Parameters, state: string): [number, number, number] {
  const v = values(p, state);
  return v.cap
    ? [v.capSize * (v.hex ? 2 / Math.sqrt(3) : 1), v.capSize, v.length + v.capThickness]
    : [v.major * 2, v.major * 2, v.length];
}
export function geometry(p: Parameters, state: string): Group {
  const v = values(p, state);
  // Indexed closed radial surface. 96 angular segments and >=48 axial samples/pitch
  // keep both ends planar while matching the analytical helical cut in FreeCAD.
  const segments = 96,
    levels = v.printed ? Math.ceil((v.length / v.pitch) * 48) : 1;
  const positions: number[] = [],
    indices: number[] = [];
  const rings: number[][] = [];
  const ring = (z: number, radius: number | ((angle: number) => number)) => {
    const row: number[] = [];
    if (radius === 0) {
      row.push(positions.length / 3);
      positions.push(0, 0, z);
    } else
      for (let i = 0; i < segments; i++) {
        const a = (TAU * i) / segments,
          r = typeof radius === 'number' ? radius : radius(a);
        row.push(positions.length / 3);
        positions.push(r * Math.cos(a), r * Math.sin(a), z);
      }
    rings.push(row);
  };
  const outline = (a: number) => v.capSize / 2 / (v.hex ? Math.cos((a % (TAU / 6)) - TAU / 12) : 1);
  const threadRings = (reverse: boolean) => {
    for (let j = 0; j <= levels; j++) {
      const z = (v.length * (reverse ? levels - j : j)) / levels;
      ring(z, (a) => radiusAt(p, state, z, a));
    }
  };
  if (v.cap && v.internal) {
    ring(0, outline);
    ring(v.length + v.capThickness, outline);
    ring(v.length + v.capThickness, v.bore);
    ring(v.length, v.bore);
    threadRings(true);
  } else {
    threadRings(false);
    if (v.cap) {
      ring(v.length, outline);
      ring(v.length + v.capThickness, outline);
    }
    ring(v.length + (v.cap ? v.capThickness : 0), v.bore);
    ring(0, v.bore);
  }
  // Follow the complete material boundary: outer wall upwards, inner wall downwards.
  // A zero-radius ring is a shared fan vertex, never coincident degenerate triangles.
  for (let j = 0; j < rings.length; j++) {
    const lower = rings[j],
      upper = rings[(j + 1) % rings.length];
    if (lower.length === 1 && upper.length === 1) continue;
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      if (lower.length === 1) indices.push(lower[0], upper[n], upper[i]);
      else if (upper.length === 1) indices.push(lower[i], lower[n], upper[0]);
      else indices.push(lower[i], lower[n], upper[i], lower[n], upper[n], upper[i]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  // Keep planar cap ends and wrench flats sharp while smoothing the helix.
  const shaded = toCreasedNormals(g, Math.PI / 4);
  g.dispose();
  const mesh = new Mesh(shaded, material(v.internal ? 0xd9a565 : 0x9faebd));
  mesh.name = v.cap
    ? `${v.hex ? 'Hexagonal' : 'Round'} ${v.internal ? 'threaded cap' : 'threaded plug'}${v.bore ? ' with through hole' : ''}`
    : v.internal
      ? 'Internal thread · subtract this solid'
      : 'External thread · fuse this solid';
  if (!v.printed)
    showThreads(mesh, [
      {
        origin: [0, 0, 0],
        axis: [0, 0, 1],
        diameter: v.major * 2,
        pitch: v.pitch,
        length: v.length,
        internal: v.internal,
        left: p.handedness === 'left',
      },
    ]);
  return new Group().add(mesh);
}
export function python(p: Parameters, state: string): string {
  const v = values(p, state);
  // Preserve double precision for inch conversions and fine pitches.
  const f = (n: number) => String(n);
  const halfRoot = (v.pitch - v.base) / 2;
  const overlap = v.pitch * 0.08;
  const halfOuter = (v.pitch - v.crest) / 2 + overlap * Math.tan((v.angle * Math.PI) / 360);
  return `# ${v.cap ? 'Finished threaded cap / plug' : 'Boolean tool'}: ${v.internal ? 'INTERNAL thread' : 'EXTERNAL thread'}
# One closed solid; no automatic modification of existing objects.
# Z=0 is the lower end; helix axis is +Z. Length=${f(v.length)} mm.
thread_pitch = ${f(v.pitch)}
thread_lead = ${f(v.lead)}
thread_major = ${f(v.major)}
thread_root = ${f(v.root)}
thread_length = ${f(v.length)}
shape = Part.makeCylinder(thread_major, thread_length)
${
  v.printed
    ? `profile_points = [App.Vector(thread_root,0,${f(-halfRoot)}), App.Vector(thread_major+${f(overlap)},0,${f(-halfOuter)}), App.Vector(thread_major+${f(overlap)},0,${f(halfOuter)}), App.Vector(thread_root,0,${f(halfRoot)})]
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
    shape = shape.cut(tool)`
    : '# Machined thread: nominal cylindrical envelope; refer to ThreadCallouts.'
}
${
  v.cap
    ? `cap_size = ${f(v.capSize)}
cap_thickness = ${f(v.capThickness)}
cap_bottom = ${v.internal ? '0' : 'thread_length'}
cap_height = ${v.internal ? 'thread_length + cap_thickness' : 'cap_thickness'}
${
  v.hex
    ? `cap_radius = cap_size / math.sqrt(3)
cap_points = [App.Vector(cap_radius*math.cos(i*math.pi/3),cap_radius*math.sin(i*math.pi/3),cap_bottom) for i in range(6)]
cap_body = Part.Face(Part.Wire(Part.makePolygon(cap_points+[cap_points[0]]).Edges)).extrude(App.Vector(0,0,cap_height))`
    : 'cap_body = Part.makeCylinder(cap_size/2,cap_height,App.Vector(0,0,cap_bottom))'
}
shape = ${v.internal ? 'cap_body.cut(shape)' : 'shape.fuse(cap_body)'}
`
    : ''
}${v.bore ? `shape = shape.cut(Part.makeCylinder(${f(v.bore)}, ${f(v.length + (v.cap ? v.capThickness : 0) + 2)}, App.Vector(0,0,-1)))\n` : ''}
# Preserve sweep patch boundaries. Refining these faces can create an
# unorientable result in a subsequent Part Cut despite a valid tool itself.
if shape.isNull() or not shape.isValid() or len(shape.Solids)!=1 or not shape.isClosed():
    raise ValueError("Thread Boolean tool must be one valid closed solid.")
${threadMetadataPython([
  {
    designation: `${p.family === 'metric' ? 'M' : String(p.family).toUpperCase() + ' D'}${p.diameter}×${v.pitch} ${v.hand < 0 ? 'LH' : 'RH'}; ${v.starts} start(s)`,
    internal: v.internal,
    nominalDiameter: Number(p.diameter),
    pitch: v.pitch,
    length: v.length,
    origin: [0, 0, 0],
    axis: [0, 0, 1],
    representation: v.printed ? 'printed-helix' : 'nominal-cylinder',
  } satisfies ThreadCallout,
])}`;
}
