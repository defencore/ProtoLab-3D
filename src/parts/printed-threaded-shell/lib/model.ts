import { BufferGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Parameters } from '../../../core/types';
import { material } from '../../../core/geometry';
import {
  nativeThreadDepth,
  nativeThreadExpression,
  nativeThreadPython,
} from '../../../core/thread-native';
import { withGeometryMode } from '../../../core/geometry-mode';

export function layout(p: Parameters) {
  const diameter = Number(p.diameter),
    pitch = Number(p.pitch),
    height = Number(p.height),
    length = Number(p.threadLength),
    wall = Number(p.wall),
    floor = Number(p.floor),
    roof = Number(p.roof),
    gap = Number(p.roofGap),
    clearance = Number(p.clearance),
    radius = diameter / 2,
    root = radius - nativeThreadDepth(pitch),
    bore = root - wall,
    shoulder = height - length,
    bodyRadius = radius + wall,
    capRadius = radius + clearance + wall,
    capDepth = length + gap,
    capHeight = capDepth + roof,
    cap = p.model === 'cap';
  return {
    diameter,
    pitch,
    height,
    length,
    wall,
    floor,
    roof,
    gap,
    clearance,
    radius,
    root,
    bore,
    shoulder,
    bodyRadius,
    capRadius,
    capDepth,
    capHeight,
    cap,
  };
}

/** Same truncated 60-degree radial profile and phase as the shared native helical kernel. */
export function threadRadius(p: Parameters, z: number, angle: number, internal: boolean): number {
  const d = layout(p),
    depth = nativeThreadDepth(d.pitch, internal),
    phase = z / d.pitch - angle / (2 * Math.PI),
    distance = Math.abs(phase - Math.round(phase)) * d.pitch;
  return (
    d.radius +
    (internal ? d.clearance : 0) -
    Math.max(0, Math.min(depth, (distance - d.pitch / 16) * Math.sqrt(3)))
  );
}

/** Closed radial material boundary: physical helix mesh, never a shader-only thread. */
export function geometry(p: Parameters): Group {
  const d = layout(p),
    count = 128,
    positions: number[] = [],
    indices: number[] = [],
    rings: number[][] = [];
  const ring = (z: number, radius: number | ((angle: number) => number)) => {
    const row: number[] = [];
    if (radius === 0) {
      row.push(positions.length / 3);
      positions.push(0, 0, z);
    } else
      for (let i = 0; i < count; i++) {
        const angle = (2 * Math.PI * i) / count,
          r = typeof radius === 'number' ? radius : radius(angle);
        row.push(positions.length / 3);
        positions.push(r * Math.cos(angle), r * Math.sin(angle), z);
      }
    rings.push(row);
  };
  if (d.cap) {
    ring(0, d.capRadius);
    ring(d.capHeight, d.capRadius);
    ring(d.capHeight, 0);
    ring(d.capDepth, 0);
    const levels = Math.ceil((d.capDepth / d.pitch) * 48);
    for (let i = levels; i >= 0; i--) {
      const z = (d.capDepth * i) / levels;
      ring(z, (angle) => threadRadius(p, z, angle, true));
    }
  } else {
    ring(0, d.bodyRadius);
    ring(d.shoulder, d.bodyRadius);
    const levels = Math.ceil((d.length / d.pitch) * 48);
    for (let i = 0; i <= levels; i++) {
      const z = (d.length * i) / levels;
      ring(d.shoulder + z, (angle) => threadRadius(p, z, angle, false));
    }
    ring(d.height, d.bore);
    ring(d.floor, d.bore);
    ring(d.floor, 0);
    ring(0, 0);
  }
  for (let j = 0; j < rings.length; j++) {
    const a = rings[j],
      b = rings[(j + 1) % rings.length];
    if (a.length === 1 && b.length === 1) continue;
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      if (a.length === 1) indices.push(a[0], b[next], b[i]);
      else if (b.length === 1) indices.push(a[i], a[next], b[0]);
      else indices.push(a[i], a[next], b[i], a[next], b[next], b[i]);
    }
  }
  const raw = new BufferGeometry();
  raw.setAttribute('position', new Float32BufferAttribute(positions, 3));
  raw.setIndex(indices);
  const smooth = toCreasedNormals(raw, Math.PI / 4);
  raw.dispose();
  const mesh = new Mesh(smooth, material(d.cap ? 0x478c99 : 0xe6a34a));
  mesh.name = d.cap ? 'Printed female threaded cap' : 'Printed male threaded can';
  return new Group().add(mesh);
}

/** Essential physical threads remain native helices even under the global Simple policy. */
export function python(p: Parameters): string {
  const d = layout(p);
  return withGeometryMode('full', () => {
    const thread = nativeThreadExpression({
      diameter: d.diameter,
      pitch: d.pitch,
      length: d.cap ? d.capDepth + d.pitch : d.length,
      internal: d.cap,
      clearance: d.cap ? d.clearance : 0,
    });
    return (
      `import math\n${nativeThreadPython()}\n_thread = ${thread}\n` +
      (d.cap
        ? `_thread.translate(App.Vector(0,0,${-d.pitch}))\nshape = Part.makeCylinder(${d.capRadius},${d.capHeight}).cut(_thread).removeSplitter()`
        : `_thread.translate(App.Vector(0,0,${d.shoulder}))\nshape = Part.makeCylinder(${d.bodyRadius},${d.shoulder}).fuse(_thread).cut(Part.makeCylinder(${d.bore},${d.height + 1},App.Vector(0,0,${d.floor}))).removeSplitter()`)
    );
  });
}

export function dimensions(p: Parameters): [number, number, number] {
  const d = layout(p),
    radius = d.cap ? d.capRadius : d.bodyRadius;
  return [2 * radius, 2 * radius, d.cap ? d.capHeight : d.height];
}

export function validate(p: Parameters): string[] {
  const d = layout(p),
    errors: string[] = [];
  if (!['body', 'cap'].includes(String(p.model)))
    errors.push('Select a physical threaded shell component.');
  if (!d.cap && d.bore < 5)
    errors.push(
      'Thread diameter, pitch and wall must leave an internal cavity radius of at least 5 mm.',
    );
  if (!d.cap && d.shoulder < d.floor + 5)
    errors.push('The can must leave at least 5 mm of cavity below the threaded neck.');
  if (d.length < 2 * d.pitch)
    errors.push('Provide at least two complete thread pitches of neck engagement.');
  if (d.cap && d.radius + d.clearance - nativeThreadDepth(d.pitch, true) <= 0)
    errors.push('Female thread geometry must leave a positive cavity radius.');
  return errors;
}
