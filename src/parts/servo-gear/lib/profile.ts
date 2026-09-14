import * as THREE from 'three';

export interface GearValues {
  teeth: number;
  angle: number;
  baseRadius: number;
  rootRadius: number;
  tipRadius: number;
  halfThickness: number;
}
interface ProfileSegment {
  kind: 'line' | 'arc' | 'spline';
  points: [number, number][];
}
export interface GearProfile {
  points: THREE.Vector2[];
  segments: ProfileSegment[];
}

function involuteAngle(radius: number, baseRadius: number): number {
  const t = Math.sqrt(Math.max(0, (radius / baseRadius) ** 2 - 1));
  return t - Math.atan(t);
}

/** Sample the actual involute above the base circle; use radial root relief below it. */
export function involuteProfile(v: GearValues): GearProfile {
  const segments: ProfileSegment[] = [];
  const points: THREE.Vector2[] = [];
  const pitchInvolute = Math.tan(v.angle) - v.angle;
  const startRadius = Math.max(v.rootRadius, v.baseRadius);
  const flankHalfAngle = (radius: number) =>
    v.halfThickness + pitchInvolute - involuteAngle(radius, v.baseRadius);
  const rootHalfAngle = flankHalfAngle(startRadius);
  const tipHalfAngle = flankHalfAngle(v.tipRadius);
  const polar = (radius: number, angle: number): [number, number] => [
    radius * Math.cos(angle),
    radius * Math.sin(angle),
  ];
  const append = (kind: ProfileSegment['kind'], samples: [number, number][]) => {
    if (Math.hypot(samples[0][0] - samples.at(-1)![0], samples[0][1] - samples.at(-1)![1]) < 1e-9)
      return;
    segments.push({ kind, points: samples });
    for (const point of samples.slice(0, -1)) points.push(new THREE.Vector2(...point));
  };
  for (let tooth = 0; tooth < v.teeth; tooth++) {
    const center = (tooth * 2 * Math.PI) / v.teeth;
    const leftRoot = polar(v.rootRadius, center - rootHalfAngle);
    const leftStart = polar(startRadius, center - rootHalfAngle);
    if (v.rootRadius < startRadius) append('line', [leftRoot, leftStart]);
    const flank = Array.from({ length: 11 }, (_, i) => {
      const t0 = Math.sqrt(Math.max(0, (startRadius / v.baseRadius) ** 2 - 1));
      const t1 = Math.sqrt((v.tipRadius / v.baseRadius) ** 2 - 1);
      const t = t0 + ((t1 - t0) * i) / 10;
      const radius = v.baseRadius * Math.sqrt(1 + t * t);
      return polar(radius, center - flankHalfAngle(radius));
    });
    append('spline', flank);
    append(
      'arc',
      Array.from({ length: 5 }, (_, i) =>
        polar(v.tipRadius, center - tipHalfAngle + (2 * tipHalfAngle * i) / 4),
      ),
    );
    append(
      'spline',
      [...flank].reverse().map(([x, y]) => {
        const radius = Math.hypot(x, y);
        return polar(radius, center + flankHalfAngle(radius));
      }),
    );
    if (v.rootRadius < startRadius)
      append('line', [
        polar(startRadius, center + rootHalfAngle),
        polar(v.rootRadius, center + rootHalfAngle),
      ]);
    const nextLeft = center + (2 * Math.PI) / v.teeth - rootHalfAngle;
    append(
      'arc',
      Array.from({ length: 5 }, (_, i) =>
        polar(v.rootRadius, center + rootHalfAngle + ((nextLeft - center - rootHalfAngle) * i) / 4),
      ),
    );
  }
  return { points, segments };
}
