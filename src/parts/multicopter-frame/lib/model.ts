import { n } from '../../../core/geometry';
import type { Parameters } from '../../../core/types';
import { box, cylinder, prism, subtract, union, type Shape } from './shapes';
import type { Piece } from './assembly';
import { armSites } from './layout';

export function pieces(p: Parameters, state: string): Piece[] {
  const B = n(p, 'bodyWidth'),
    L = n(p, 'bodyLength'),
    t = n(p, 'plate');
  const gap = n(p, 'gap'),
    a = n(p, 'armThickness'),
    w = n(p, 'armWidth');
  const R = n(p, 'wheelbase') / 2,
    stack = n(p, 'stackPitch'),
    hole = n(p, 'hole');
  const mount = n(p, 'motorPitch'),
    pad = Math.max(w, mount + hole * 3);
  const tube = p.armStyle === 'tube',
    thick = tube ? t : a;
  const explodedZ = state === 'exploded' ? -gap : 0;
  const plate = (z: number) =>
    subtract(
      box([L, B, t], [-L / 2, -B / 2, z]),
      ...[-1, 1].flatMap((x) =>
        [-1, 1].map((y) => cylinder(hole / 2, t + 2, [(x * stack) / 2, (y * stack) / 2, z - 1])),
      ),
    );
  const result: Piece[] = [
    { label: 'Bottom plate · controller mounting holes', shape: plate(0), color: 0x424a51 },
  ];
  if (state === 'body') return result;
  result.push({
    label: 'Top plate',
    shape: plate(t + gap),
    color: 0x424a51,
    z: state === 'exploded' ? gap * 1.6 : 0,
  });
  const motorCuts = (x: number, y: number, z: number, depth: number) => [
    ...[-1, 1].flatMap((dx) =>
      [-1, 1].map((dy) =>
        cylinder(hole / 2, depth + 2, [x + (dx * mount) / 2, y + (dy * mount) / 2, z - 1]),
      ),
    ),
    cylinder(n(p, 'shaftClearance') / 2, depth + 2, [x, y, z - 1]),
  ];
  const pipe = (length: number, origin: [number, number, number], axis: 'x' | 'y') => {
    const bore: [number, number, number] = [...origin];
    bore[axis === 'x' ? 0 : 1] -= 1;
    return subtract(
      cylinder(w / 2, length, origin, axis),
      cylinder(w / 2 - n(p, 'tubeWall'), length + 2, bore, axis),
    );
  };
  if (p.layout === 'quad-h') {
    const angle = (n(p, 'armAngle') * Math.PI) / 180,
      X = R * Math.cos(angle),
      Y = R * Math.sin(angle);
    const rails: Shape[] = [-1, 1].map((sign) =>
      tube
        ? pipe(2 * X - pad, [-X + pad / 2, sign * Y, -w / 2], 'x')
        : box([2 * X + pad, w, a], [-X - pad / 2, sign * Y - w / 2, -a]),
    );
    rails.push(tube ? pipe(2 * Y, [0, -Y, -w / 2], 'y') : box([w, 2 * Y, a], [-w / 2, -Y, -a]));
    const cuts: Shape[] = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        rails.push(box([pad, pad, thick], [sx * X - pad / 2, sy * Y - pad / 2, -thick]));
        cuts.push(...motorCuts(sx * X, sy * Y, -thick, thick));
      }
    result.push({
      label: 'H frame · side beams, crossmember and four motor mounts',
      shape: subtract(union(...rails), ...cuts),
      color: 0x424a51,
      z: explodedZ,
    });
  } else {
    const sites = armSites(p);
    for (const [i, site] of sites.entries()) {
      // Root clearance prevents radial arms intersecting underneath the centre plate.
      const separation = Math.min(
        ...sites
          .filter((s) => s !== site)
          .map((s) => Math.abs(((s.angle - site.angle + 540) % 360) - 180)),
      );
      const root = Math.max(L * 0.16, w / (2 * Math.tan((separation * Math.PI) / 360)) + 0.5);
      let arm: Shape;
      if (tube) {
        result.push({
          label: `Arm ${i + 1} · tube`,
          shape: pipe(R - pad / 2 - root, [root, 0, -w / 2], 'x'),
          angle: site.angle,
          color: 0x4c535a,
          z: explodedZ,
        });
        arm = box([pad, pad, t], [R - pad / 2, -pad / 2, -t]);
      } else {
        arm = prism(
          [
            [root, -w / 2],
            [R - pad / 2, -w / 2],
            [R - pad / 2, -pad / 2],
            [R + pad / 2, -pad / 2],
            [R + pad / 2, pad / 2],
            [R - pad / 2, pad / 2],
            [R - pad / 2, w / 2],
            [root, w / 2],
          ],
          a,
          -a,
        );
      }
      result.push({
        label: `Arm ${i + 1} · ${tube ? 'motor plate' : 'motor mount'}${site.paired ? ' · upper' : ''}`,
        shape: subtract(arm, ...motorCuts(R, 0, -thick, thick)),
        angle: site.angle,
        color: 0x424a51,
        z: explodedZ,
      });
      if (site.paired) {
        const spacing = n(p, 'coaxialGap'),
          bottom = -thick - spacing - t,
          d = n(p, 'spacerDiameter');
        result.push({
          label: `Arm ${i + 1} · lower coaxial motor plate`,
          shape: subtract(
            box([pad, pad, t], [R - pad / 2, -pad / 2, bottom]),
            ...motorCuts(R, 0, bottom, t),
          ),
          angle: site.angle,
          color: 0x596570,
          z: explodedZ,
        });
        for (const side of [-1, 1])
          result.push({
            label: `Arm ${i + 1} · coaxial spacer ${side === 1 ? 'left' : 'right'}`,
            shape: cylinder(d / 2, spacing, [R, (side * (pad - d)) / 2, bottom + t]),
            angle: site.angle,
            color: 0xbb8e54,
            z: explodedZ,
          });
      }
    }
  }
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      result.push({
        label: `Body spacer · ${x > 0 ? 'front' : 'rear'} ${y > 0 ? 'left' : 'right'}`,
        shape: cylinder(n(p, 'spacerDiameter') / 2, gap, [
          x * (L / 2 - n(p, 'spacerDiameter')),
          y * (B / 2 - n(p, 'spacerDiameter')),
          t,
        ]),
        color: 0xbb8e54,
      });
  return result;
}
