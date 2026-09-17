import {
  Curve,
  Vector3,
  TubeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Group,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
/** Uniform-pitch, capped spring wire. The native helix uses the same centreline. */
export function springMesh(radius: number, wire: number, height: number, turns: number): Group {
  class Helix extends Curve<Vector3> {
    constructor() {
      super();
    }
    getPoint(t: number, target = new Vector3()) {
      return target.set(
        radius * Math.cos(t * turns * 2 * Math.PI),
        radius * Math.sin(t * turns * 2 * Math.PI),
        t * height,
      );
    }
  }
  const curve = new Helix(),
    segments = turns * 96,
    sides = 32;
  const tube = new TubeGeometry(curve, segments, wire / 2, sides, false);
  const caps = [0, 1].map((end) => {
    const center = curve.getPoint(end),
      normal = curve.getTangent(end).multiplyScalar(end ? 1 : -1);
    const positions = center.toArray(),
      normals = normal.toArray(),
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
      const a = new Vector3().fromArray(positions, i * 3).sub(center),
        b = new Vector3().fromArray(positions, (i + 1) * 3).sub(center);
      if (a.cross(b).dot(normal) > 0) indices.push(0, i, i + 1);
      else indices.push(0, i + 1, i);
    }
    const cap = new BufferGeometry();
    cap.setAttribute('position', new Float32BufferAttribute(positions, 3));
    cap.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    cap.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    cap.setIndex(indices);
    return cap;
  });
  const result = new Group().add(
    new Mesh(
      mergeGeometries([tube, ...caps]),
      new MeshStandardMaterial({ metalness: 0.7, roughness: 0.3 }),
    ),
  );
  tube.dispose();
  caps.forEach((c) => c.dispose());
  return result;
}
export const springPython = [
  'def _release_spring(radius, wire, height, turns, origin):',
  '    path = Part.Wire(Part.makeHelix(height / turns, height, radius).Edges)',
  '    edge = path.Edges[0]',
  '    profile = Part.Wire([Part.makeCircle(wire / 2, edge.valueAt(edge.FirstParameter), edge.tangentAt(edge.FirstParameter))])',
  '    spring = path.makePipeShell([profile], True, True)',
  '    spring.translate(App.Vector(*origin))',
  '    return spring',
];
