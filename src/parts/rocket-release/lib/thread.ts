import modeling from '@jscad/modeling';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
export interface Thread {
  diameter: number;
  pitch: number;
  length: number;
  clearance: number;
  internal: boolean;
}
export function threadGeometry(t: Thread, segments = 64, samples = 24): BufferGeometry {
  const levels = Math.ceil((t.length / t.pitch) * samples),
    a: number[] = [],
    ids: number[] = [];
  const major = t.diameter / 2 + t.clearance,
    depth = t.pitch * Math.sqrt(3) * (t.internal ? 5 / 16 : 17 / 48);
  for (let j = 0; j <= levels; j++)
    for (let i = 0; i < segments; i++) {
      const z = (t.length * j) / levels,
        theta = (2 * Math.PI * i) / segments,
        phase = z / t.pitch - theta / (2 * Math.PI);
      const d = Math.abs(phase - Math.round(phase)) * t.pitch;
      const r = major - Math.max(0, Math.min(depth, (d - t.pitch / 16) * Math.sqrt(3)));
      a.push(r * Math.cos(theta), r * Math.sin(theta), z);
    }
  for (let j = 0; j < levels; j++)
    for (let i = 0; i < segments; i++) {
      const p = j * segments + i,
        q = j * segments + ((i + 1) % segments);
      ids.push(p, q, p + segments, q, q + segments, p + segments);
    }
  const bottom = a.length / 3;
  a.push(0, 0, 0);
  const top = a.length / 3;
  a.push(0, 0, t.length);
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    ids.push(bottom, next, i, top, levels * segments + i, levels * segments + next);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(a, 3));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}
export function threadSolid(t: Thread): Geom3 {
  const g = threadGeometry(
      t,
      t.diameter >= 4 || !t.internal ? 24 : 12,
      t.diameter >= 4 || !t.internal ? 12 : 6,
    ),
    pos = g.getAttribute('position'),
    idx = g.index!;
  const polygons = [];
  for (let i = 0; i < idx.count; i += 3)
    polygons.push(
      modeling.geometries.poly3.create(
        [0, 1, 2].map((j) => {
          const k = idx.getX(i + j);
          return [pos.getX(k), pos.getY(k), pos.getZ(k)];
        }),
      ),
    );
  g.dispose();
  return modeling.geometries.geom3.create(polygons);
}
export const threadPython = [
  'def _release_thread(d,p,h,c,internal):',
  '    key=(d,p,h,c,internal)',
  '    if key in _release_thread_cache: return _release_thread_cache[key].copy()',
  '    major=d/2+c',
  '    depth=p*math.sqrt(3)*(5/16 if internal else 17/48)',
  '    root=major-depth',
  '    crest=p/8',
  '    base=crest+2*depth/math.sqrt(3)',
  '    hr=(p-base)/2',
  '    ho=(p-crest)/2+0.08*p/math.sqrt(3)',
  '    pts=[App.Vector(root,0,-hr),App.Vector(major+0.08*p,0,-ho),App.Vector(major+0.08*p,0,ho),App.Vector(root,0,hr)]',
  '    path=Part.Wire(Part.makeLongHelix(p,h+2*p,root,0,False).Edges)',
  '    groove=path.makePipeShell([Part.Wire(Part.makePolygon(pts+[pts[0]]).Edges)],True,True)',
  '    if groove.Volume<0: groove.reverse()',
  '    groove.translate(App.Vector(0,0,-p/2))',
  '    result=Part.makeCylinder(major,h).cut(groove)',
  '    if not result.isValid() or len(result.Solids)!=1: raise ValueError("Invalid release thread")',
  '    _release_thread_cache[key]=result.copy()',
  '    return result',
  '_release_thread_cache={}',
];
