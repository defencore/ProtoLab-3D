import { LatheGeometry, Mesh, Vector2 } from 'three';
import { material, n, num, numberParameter } from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';

export type TurnedProfile = [number, number][];

function cleanProfile(points: TurnedProfile): TurnedProfile {
  return points.filter(
    (point, index) =>
      !index || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > 1e-9,
  );
}

/** Meridians use radius / Z coordinates and include their closing point. */
export function turnedMesh(points: TurnedProfile, color = 0x85898e): Mesh {
  const geometry = new LatheGeometry(
    cleanProfile(points).map((point) => new Vector2(...point)),
    96,
  );
  geometry.rotateX(Math.PI / 2);
  return new Mesh(geometry, material(color));
}

export function turnedPython(points: TurnedProfile): string {
  return `Part.Face(Part.makePolygon([${cleanProfile(points)
    .map(([radius, z]) => `App.Vector(${num(radius)}, 0, ${num(z)})`)
    .join(', ')}])).revolve(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 360)`;
}

export const envelopeParameters = [
  numberParameter('bore', 'Shaft / bore diameter', 'd', 'Envelope', 1, 500),
  numberParameter('outer', 'Outside diameter', 'D', 'Envelope', 3, 1000),
  numberParameter('width', 'Overall axial width', 'B', 'Envelope', 1, 300),
];

export function validateEnvelope(p: Parameters): string[] {
  return n(p, 'outer') <= n(p, 'bore') + 0.5
    ? ['Outside diameter must leave more than 0.25 mm of radial material.']
    : [];
}

export function sphericalMeridian(radius: number, width: number, ascending = true): TurnedProfile {
  return Array.from({ length: 33 }, (_, i) => {
    const z = (i / 32 - 0.5) * width * (ascending ? 1 : -1);
    return [Math.sqrt(radius * radius - z * z), z];
  });
}
