import { currentGeometryMode } from '../../geometry-mode';
import { nativeThreadPython } from '../../thread-native';
import modeling from '@jscad/modeling';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';
export interface Thread {
  diameter: number;
  pitch: number;
  length: number;
  clearance: number;
  internal: boolean;
  /** Printed features use sampled solids in Full preview; native Full always uses real helices. */
  process?: 'printed';
  designation?: string;
}
export function threadGeometry(t: Thread, segments = 64, samples = 24): BufferGeometry {
  const printed = t.process === 'printed' && currentGeometryMode() === 'full';
  const levels = printed ? Math.ceil((t.length / t.pitch) * samples) : 1,
    a: number[] = [],
    ids: number[] = [];
  const major = t.diameter / 2 + (t.process === 'printed' ? t.clearance : 0),
    depth = printed ? t.pitch * Math.sqrt(3) * (t.internal ? 5 / 16 : 17 / 48) : 0;
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
  if (t.process !== 'printed' || currentGeometryMode() === 'simple')
    return modeling.primitives.cylinder({
      radius: t.diameter / 2 + (t.process === 'printed' ? t.clearance : 0),
      height: t.length,
      center: [0, 0, t.length / 2],
      segments: 64,
    });
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
export function threadPython(): string[] {
  return nativeThreadPython().split('\n');
}
