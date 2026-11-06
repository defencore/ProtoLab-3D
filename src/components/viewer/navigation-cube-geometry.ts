import { Quaternion, Vector3 } from 'three';
import { cameraViews, type CameraView } from './camera-views';

export interface NavigationCubeRegion {
  id: string;
  kind: 'face' | 'edge' | 'corner';
  label: string;
  direction: Vector3;
  vertices: Vector3[];
  view?: CameraView;
  right?: Vector3;
  up?: Vector3;
}

export interface ProjectedNavigationCubeRegion {
  region: NavigationCubeRegion;
  points: [number, number][];
  depth: number;
  labelTransform?: [number, number, number, number, number, number];
}

const bevel = 0.72;
const scale = 34;
const center = 60;

function orderVertices(vertices: Vector3[], normal: Vector3): Vector3[] {
  const centroid = vertices.reduce((sum, vertex) => sum.add(vertex), new Vector3());
  centroid.divideScalar(vertices.length);
  const first = vertices[0].clone().sub(centroid).normalize();
  const second = normal.clone().cross(first);
  return vertices.sort((a, b) => {
    const p = a.clone().sub(centroid);
    const q = b.clone().sub(centroid);
    return Math.atan2(p.dot(second), p.dot(first)) - Math.atan2(q.dot(second), q.dot(first));
  });
}

function facePoint(face: NavigationCubeRegion, horizontal: number, vertical: number): Vector3 {
  return face.direction
    .clone()
    .addScaledVector(face.right!, horizontal)
    .addScaledVector(face.up!, vertical);
}

function buildRegions(): NavigationCubeRegion[] {
  const faces: NavigationCubeRegion[] = cameraViews
    .filter((view) => view.value !== 'isometric')
    .map((view) => {
      const direction = new Vector3(...view.direction);
      const up = new Vector3(...view.up);
      const face: NavigationCubeRegion = {
        id: view.value,
        kind: 'face',
        label: view.label,
        direction,
        up,
        right: up.clone().cross(direction),
        vertices: [],
        view: view.value,
      };
      face.vertices = [
        facePoint(face, -bevel, -bevel),
        facePoint(face, bevel, -bevel),
        facePoint(face, bevel, bevel),
        facePoint(face, -bevel, bevel),
      ];
      return face;
    });
  const regions = [...faces];
  for (let first = 0; first < faces.length; first++) {
    for (let second = first + 1; second < faces.length; second++) {
      const a = faces[first];
      const b = faces[second];
      if (Math.abs(a.direction.dot(b.direction)) > 0.1) continue;
      const boundary = (face: NavigationCubeRegion, other: NavigationCubeRegion) => {
        const horizontal = face.right!.dot(other.direction);
        const vertical = face.up!.dot(other.direction);
        return Math.abs(horizontal) > 0.5
          ? [
              facePoint(face, Math.sign(horizontal) * bevel, -bevel),
              facePoint(face, Math.sign(horizontal) * bevel, bevel),
            ]
          : [
              facePoint(face, -bevel, Math.sign(vertical) * bevel),
              facePoint(face, bevel, Math.sign(vertical) * bevel),
            ];
      };
      const direction = a.direction.clone().add(b.direction).normalize();
      regions.push({
        id: `${a.id}-${b.id}`,
        kind: 'edge',
        label: `${a.label} ${b.label.toLowerCase()} edge`,
        direction,
        vertices: orderVertices([...boundary(a, b), ...boundary(b, a)], direction),
      });
    }
  }
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const adjacent = faces.filter((face) => face.direction.dot(new Vector3(x, y, z)) > 0.5);
        const direction = new Vector3(x, y, z).normalize();
        regions.push({
          id: adjacent.map((face) => face.id).join('-'),
          kind: 'corner',
          label: `${adjacent.map((face) => face.label).join(' ')} corner`,
          direction,
          vertices: orderVertices(
            [
              new Vector3(x, y * bevel, z * bevel),
              new Vector3(x * bevel, y, z * bevel),
              new Vector3(x * bevel, y * bevel, z),
            ],
            direction,
          ),
        });
      }
  return regions;
}

/** All directions use the viewer's displayed Y-up frame, as do camera presets. */
export const navigationCubeRegions = buildRegions();

/** Orthographic SVG projection of the cube using the actual camera rotation. */
export function projectNavigationCube(
  cameraQuaternion: Quaternion,
): ProjectedNavigationCubeRegion[] {
  const inverse = cameraQuaternion.clone().invert();
  const towardCamera = new Vector3(0, 0, 1).applyQuaternion(cameraQuaternion);
  return navigationCubeRegions
    .filter((region) => region.direction.dot(towardCamera) > 1e-5)
    .map((region): ProjectedNavigationCubeRegion => {
      const vertices = region.vertices.map((vertex) => vertex.clone().applyQuaternion(inverse));
      const projected: ProjectedNavigationCubeRegion = {
        region,
        points: vertices.map((point) => [center + point.x * scale, center - point.y * scale]),
        depth: vertices.reduce((sum, point) => sum + point.z, 0) / vertices.length,
      };
      if (region.kind === 'face') {
        const origin = region.direction.clone().applyQuaternion(inverse);
        const right = region.right!.clone().applyQuaternion(inverse);
        const up = region.up!.clone().applyQuaternion(inverse);
        projected.labelTransform = [
          right.x,
          -right.y,
          -up.x,
          up.y,
          center + origin.x * scale,
          center - origin.y * scale,
        ];
      }
      return projected;
    })
    .sort((a, b) => a.depth - b.depth);
}
