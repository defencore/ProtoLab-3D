import { bearingPalette, bearingRgb } from '../../../core/hardware/bearing-appearance';
import { analyticRevolvePython } from '../../../core/hardware/analytic-profile';
import { Group, LatheGeometry, Mesh, Vector2 } from 'three';
import {
  annulusPython,
  compoundPython,
  material,
  n,
  num,
  ring,
  sphere,
} from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { cageMesh, cagePython, type CageLayout } from './cage';

type Profile = [number, number][];

function sizes(p: Parameters) {
  const bore = n(p, 'bore') / 2,
    outer = n(p, 'outer') / 2,
    width = n(p, 'width');
  const gap = outer - bore,
    radius = Math.min(gap * 0.255, width * 0.3);
  return { bore, outer, width, gap, radius, pitch: (bore + outer) / 2, count: n(p, 'balls') };
}

function profiles(p: Parameters): Profile[] {
  const { bore, outer, width, gap, radius, pitch } = sizes(p);
  const groove = radius + Math.min(gap, width) * 0.005;
  const inner: Profile = [],
    race: Profile = [];
  for (let i = 0; i <= 96; i++) {
    const z = width * (i / 96 - 0.5),
      chamfer = Math.min(gap, width) * 0.035;
    const reach = Math.abs(z) < groove ? Math.sqrt(groove ** 2 - z ** 2) : 0;
    const edge = Math.max(0, Math.abs(z) - (width / 2 - chamfer));
    inner.push([Math.min(bore + gap * 0.39, pitch - reach) - edge, z]);
    race.push([Math.max(outer - gap * 0.39, pitch + reach) + edge, z]);
  }
  const flange = n(p, 'flangeOuter') / 2;
  // The locating lip is integral with the outer ring and lies within the overall width.
  return [
    [[bore, -width / 2], ...inner, [bore, width / 2]],
    [
      [outer, -width / 2],
      [outer, width / 2 - n(p, 'flangeWidth')],
      [flange, width / 2 - n(p, 'flangeWidth')],
      [flange, width / 2],
      ...race.reverse(),
    ],
  ];
}

function revolved(profile: Profile): Mesh {
  const geometry = new LatheGeometry(
    [...profile, profile[0]].map(([r, z]) => new Vector2(r, z)),
    96,
  );
  geometry.rotateX(Math.PI / 2);
  return new Mesh(geometry, material(bearingPalette.race));
}

function revolvePython(profile: Profile, offset: number): string {
  return analyticRevolvePython(profile, offset);
}

function cage(p: Parameters): CageLayout {
  const v = sizes(p);
  return {
    pitch: v.pitch,
    radius: v.radius,
    count: v.count,
    center: 0,
    halfWindow: v.radius * 1.03,
    band: v.radius * 0.075,
    rowPhase: 0,
  };
}

export function validateBearing(p: Parameters): string[] {
  const { bore, outer, width, radius, pitch, count } = sizes(p);
  const errors: string[] = [];
  if (outer - bore <= 0.2)
    errors.push('Body outside diameter must exceed the bore by more than 0.4 mm.');
  if (n(p, 'flangeOuter') <= n(p, 'outer'))
    errors.push('Flange outside diameter must exceed the bearing body diameter.');
  if (n(p, 'flangeWidth') >= width)
    errors.push('Flange thickness must be less than the overall bearing width.');
  if (!Number.isInteger(count)) errors.push('Ball count must be a whole number.');
  if (count > 2 && 2 * pitch * Math.sin(Math.PI / count) <= radius * 2.3)
    errors.push('Too many balls for this envelope. Reduce the illustrative ball count.');
  return errors;
}

export function bearingGeometry(p: Parameters, state: string): Group {
  const group = new Group(),
    v = sizes(p),
    offset = state === 'exploded' ? v.width * 0.9 : 0;
  profiles(p).forEach((profile, index) => {
    const mesh = revolved(profile);
    mesh.position.z = index === 0 ? -offset : offset;
    mesh.name = index === 0 ? 'Inner ring' : 'Flanged outer ring';
    group.add(mesh);
  });
  group.add(cageMesh(cage(p)));
  for (let i = 0; i < v.count; i++) {
    const angle = (i * Math.PI * 2) / v.count,
      ball = sphere(v.radius, bearingPalette.flangedBall);
    ball.position.set(Math.cos(angle) * v.pitch, Math.sin(angle) * v.pitch, 0);
    ball.name = `Ball ${i + 1}`;
    group.add(ball);
  }
  if (p.seals !== 'open')
    for (const sign of [-1, 1]) {
      const seal = ring(
        v.outer - v.gap * 0.4,
        v.bore + v.gap * 0.4,
        v.width * 0.05,
        p.seals === 'metal' ? bearingPalette.metalShield : bearingPalette.rubberSeal,
      );
      seal.position.z = sign * (v.width * 0.455 + offset);
      seal.name = `${sign < 0 ? 'Rear' : 'Front'} ${p.seals === 'metal' ? 'shield' : 'seal'}`;
      group.add(seal);
    }
  return group;
}

export function bearingPython(p: Parameters, state: string): string {
  const v = sizes(p),
    offset = state === 'exploded' ? v.width * 0.9 : 0;
  const shapes = profiles(p).map((profile, index) =>
    revolvePython(profile, index === 0 ? -offset : offset),
  );
  const labels = ['Inner ring', 'Flanged outer ring', 'Windowed ball cage'];
  const colors = [
    bearingRgb(bearingPalette.race),
    bearingRgb(bearingPalette.race),
    bearingRgb(bearingPalette.cage),
  ];
  shapes.push('ball_cage');
  for (let i = 0; i < v.count; i++) {
    const angle = (i * Math.PI * 2) / v.count;
    shapes.push(
      `Part.makeSphere(${num(v.radius)}, App.Vector(${num(Math.cos(angle) * v.pitch)}, ${num(Math.sin(angle) * v.pitch)}, 0))`,
    );
    labels.push(`Ball ${i + 1}`);
    colors.push(bearingRgb(bearingPalette.flangedBall));
  }
  if (p.seals !== 'open')
    for (const sign of [-1, 1]) {
      shapes.push(
        annulusPython(
          v.outer - v.gap * 0.4,
          v.bore + v.gap * 0.4,
          v.width * 0.05,
          sign * (v.width * 0.455 + offset) - v.width * 0.025,
        ),
      );
      labels.push(`${sign < 0 ? 'Rear' : 'Front'} ${p.seals === 'metal' ? 'shield' : 'seal'}`);
      colors.push(
        bearingRgb(p.seals === 'metal' ? bearingPalette.metalShield : bearingPalette.rubberSeal),
      );
    }
  return [
    cagePython(cage(p), 'ball_cage'),
    compoundPython(shapes),
    `component_labels = ${JSON.stringify(labels)}`,
    `component_colors = ${JSON.stringify(colors)}`,
  ].join('\n');
}
