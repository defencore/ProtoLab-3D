import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, num } from '../../../../core/geometry';
import type { ParameterDefinition } from '../../../../core/types';

export const tau = Math.PI * 2;
export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const choice = (
  key: string,
  label: string,
  group: string,
  options: [string, string][],
): ParameterDefinition => ({
  key,
  label,
  group,
  type: 'select',
  options: options.map(([value, name]) => ({ value, label: name })),
});
export const handedness = choice('handedness', 'Winding direction', 'Coil', [
  ['right', 'Right hand'],
  ['left', 'Left hand'],
]);

export function sample(fn: (t: number) => THREE.Vector3, steps: number): THREE.Vector3[] {
  return Array.from({ length: steps + 1 }, (_, i) => fn(i / steps));
}

export function joinPaths(...paths: THREE.Vector3[][]): THREE.Vector3[] {
  return paths.flatMap((path, index) => (index === 0 ? path : path.slice(1)));
}

export function bezier(
  start: THREE.Vector3,
  tangent: THREE.Vector3,
  end: THREE.Vector3,
  endTangent: THREE.Vector3,
  reach: number,
): THREE.Vector3[] {
  const curve = new THREE.CubicBezierCurve3(
    start,
    start.clone().addScaledVector(tangent, reach),
    end.clone().addScaledVector(endTangent, -reach),
    end,
  );
  return sample((t) => curve.getPoint(t), 16);
}

/** A capped continuous wire mesh, including bent ends, from one centreline. */
export function wireGeometry(points: THREE.Vector3[], wireDiameter: number): THREE.Group {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segments = Math.max(100, points.length * 3);
  const sides = 16;
  const tube = new THREE.TubeGeometry(curve, segments, wireDiameter / 2, sides, false);
  const caps = [0, 1].map((end) => {
    const center = curve.getPoint(end),
      normal = curve.getTangent(end).multiplyScalar(end === 0 ? -1 : 1);
    const positions = [...center.toArray()],
      normals = [...normal.toArray()],
      uvs = [0.5, 0.5],
      indices: number[] = [];
    const source = tube.getAttribute('position'),
      start = end * segments * (sides + 1);
    for (let i = 0; i <= sides; i++) {
      positions.push(source.getX(start + i), source.getY(start + i), source.getZ(start + i));
      normals.push(...normal.toArray());
      uvs.push(0, 0);
    }
    for (let i = 1; i <= sides; i++) {
      const a = new THREE.Vector3().fromArray(positions, i * 3).sub(center);
      const b = new THREE.Vector3().fromArray(positions, (i + 1) * 3).sub(center);
      if (a.cross(b).dot(normal) > 0) indices.push(0, i, i + 1);
      else indices.push(0, i + 1, i);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    cap.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    cap.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    cap.setIndex(indices);
    return cap;
  });
  const mesh = new THREE.Mesh(mergeGeometries([tube, ...caps]), material());
  tube.dispose();
  caps.forEach((cap) => cap.dispose());
  return new THREE.Group().add(mesh);
}

export function wireDimensions(
  points: THREE.Vector3[],
  diameter: number,
): [number, number, number] {
  const group = wireGeometry(points, diameter);
  const dimensions = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).toArray();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  return dimensions;
}

/** Straight runs remain lines; curved runs are interpolated between shared endpoints. */
export function wirePython(points: THREE.Vector3[], wireDiameter: number): string {
  const lineRuns: [number, number][] = [];
  let runStart = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i]
      .clone()
      .sub(points[i - 1])
      .normalize();
    const b = points[i + 1].clone().sub(points[i]).normalize();
    const straight = a.dot(b) > 0.999999999;
    if (straight && runStart === -1) runStart = i - 1;
    if ((!straight || i === points.length - 2) && runStart >= 0) {
      const end = straight ? i + 1 : i;
      if (end - runStart >= 3) lineRuns.push([runStart, end]);
      runStart = -1;
    }
  }
  const pieces: { start: number; end: number; line: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of lineRuns) {
    if (start > cursor) pieces.push({ start: cursor, end: start, line: false });
    pieces.push({ start, end, line: true });
    cursor = end;
  }
  if (cursor < points.length - 1)
    pieces.push({ start: cursor, end: points.length - 1, line: false });
  const python = [
    `points = [App.Vector(*point) for point in [\n${points.map((p) => `    (${p.toArray().map(num).join(', ')})`).join(',\n')}\n]]`,
    'edges = []',
  ];
  for (const piece of pieces) {
    if (piece.line)
      python.push(`edges.append(Part.makeLine(points[${piece.start}], points[${piece.end}]))`);
    else {
      python.push(
        'curve = Part.BSplineCurve()',
        `curve.interpolate(points[${piece.start}:${piece.end + 1}])`,
        'edges.append(curve.toShape())',
      );
    }
  }
  python.push(
    'path = Part.Wire(edges)',
    `profile = Part.Wire([Part.makeCircle(${num(wireDiameter / 2)}, points[0], edges[0].tangentAt(edges[0].FirstParameter))])`,
    'shape = path.makePipeShell([profile], True, True, 2)',
  );
  return python.join('\n');
}

/** Detect non-adjacent wire interference with a spatial grid and dense centreline samples. */
export function hasWireCollision(points: THREE.Vector3[], diameter: number): boolean {
  const cells = new Map<string, { point: THREE.Vector3; distance: number }[]>();
  const clearanceSquared = (diameter * 0.98) ** 2;
  let travelled = 0;
  for (let segment = 1; segment < points.length; segment++) {
    const start = points[segment - 1],
      end = points[segment],
      length = start.distanceTo(end);
    const steps = Math.max(1, Math.ceil(length / (diameter * 0.45)));
    for (let j = 0; j < steps; j++) {
      const point = start.clone().lerp(end, j / steps),
        distance = travelled + (length * j) / steps;
      const x = Math.floor(point.x / diameter),
        y = Math.floor(point.y / diameter),
        z = Math.floor(point.z / diameter);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            for (const other of cells.get(`${x + dx},${y + dy},${z + dz}`) ?? []) {
              if (
                distance - other.distance > diameter * 2.5 &&
                point.distanceToSquared(other.point) < clearanceSquared
              )
                return true;
            }
          }
      const key = `${x},${y},${z}`,
        bucket = cells.get(key) ?? [];
      bucket.push({ point, distance });
      cells.set(key, bucket);
    }
    travelled += length;
  }
  return false;
}

/** Parallel-transported circular sections avoid Frenet-frame singularities at hook inflections. */
export function wireLoftPython(points: THREE.Vector3[], wireDiameter: number): string {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const sectionCount = Math.max(100, points.length * 2);
  const frames = curve.computeFrenetFrames(sectionCount, false);
  const sections = Array.from({ length: sectionCount + 1 }, (_, i) => {
    const origin = curve.getPointAt(i / sectionCount),
      x = frames.normals[i],
      y = frames.binormals[i],
      z = frames.tangents[i];
    return [x.x, y.x, z.x, origin.x, x.y, y.y, z.y, origin.y, x.z, y.z, z.z, origin.z, 0, 0, 0, 1];
  });
  return `sections = []\nfor coefficients in [\n${sections.map((section) => `    (${section.map(num).join(', ')})`).join(',\n')}\n]:\n    section = Part.Wire([Part.makeCircle(${num(wireDiameter / 2)})])\n    section.transformShape(App.Matrix(*coefficients))\n    sections.append(section)\nshape = Part.makeLoft(sections, True, True)`;
}
