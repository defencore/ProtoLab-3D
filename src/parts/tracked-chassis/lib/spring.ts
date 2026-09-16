import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { material, num } from '../../../core/geometry';

export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export function sample(fn: (t: number) => THREE.Vector3, steps: number): THREE.Vector3[] {
  return Array.from({ length: steps + 1 }, (_, i) => fn(i / steps));
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
  const segments = Math.max(100, points.length * 2);
  const sides = 32;
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
