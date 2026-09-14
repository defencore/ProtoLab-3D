import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { type Component, type Solid, cylinder, cut, union, intersection } from './solids';

export function pistonValues(p: Parameters) {
  const radius = (n(p, 'nominalBore') - n(p, 'diametralClearance')) / 2,
    height = n(p, 'height'),
    wall = n(p, 'skirtWall');
  const grooveCenters = Array.from(
    { length: n(p, 'grooveCount') },
    (_, i) => height - n(p, 'topLand') - n(p, 'grooveWidth') / 2 - i * n(p, 'groovePitch'),
  );
  const pinZ = height - n(p, 'compressionHeight'),
    clipInner = n(p, 'pinDiameter') / 2 - n(p, 'clipRadialWidth') * 0.4,
    clipOuter = clipInner + n(p, 'clipRadialWidth');
  const clipX = n(p, 'pinLength') / 2 + n(p, 'pinEndClearance') + n(p, 'clipThickness') / 2;
  return {
    radius,
    height,
    wall,
    innerRadius: radius - wall,
    grooveCenters,
    pinZ,
    clipInner,
    clipOuter,
    clipX,
    bossGap: 2 * (radius - wall - n(p, 'bossDepth')),
  };
}
function groove(p: Parameters, z: number): Solid {
  const v = pistonValues(p),
    w = n(p, 'grooveWidth');
  return cut(
    cylinder(v.radius + 1, w, [0, 0, z]),
    cylinder(v.radius - n(p, 'grooveDepth'), w + 0.2, [0, 0, z]),
  );
}
export function pistonBody(p: Parameters): Solid {
  const v = pistonValues(p),
    blank = cylinder(v.radius, v.height, [0, 0, v.height / 2]);
  let body: Solid;
  if (p.variant === 'pneumatic')
    body = cut(blank, cylinder(n(p, 'rodBore') / 2, v.height + 2, [0, 0, v.height / 2]));
  else {
    const innerLength = v.height - n(p, 'crownThickness');
    const shell = cut(
      blank,
      cylinder(v.innerRadius, innerLength + 0.2, [0, 0, (innerLength - 0.2) / 2]),
    );
    const bossLength = v.wall + n(p, 'bossDepth'),
      bossCenter = v.radius - bossLength / 2;
    body = intersection(
      union(
        shell,
        ...[-1, 1].map((sign) =>
          cylinder(n(p, 'bossDiameter') / 2, bossLength, [sign * bossCenter, 0, v.pinZ], 'x'),
        ),
      ),
      blank,
    );
    const cuts: Solid[] = [
      cylinder(
        (n(p, 'pinDiameter') + n(p, 'pinBoreClearance')) / 2,
        2 * v.radius + 2,
        [0, 0, v.pinZ],
        'x',
      ),
    ];
    for (const sign of [-1, 1])
      cuts.push(
        cylinder(
          v.clipOuter + n(p, 'clipGrooveClearance'),
          n(p, 'clipThickness') + 2 * n(p, 'clipGrooveClearance'),
          [sign * v.clipX, 0, v.pinZ],
          'x',
        ),
      );
    if (p.crown === 'dished')
      cuts.push(
        cylinder(n(p, 'dishDiameter') / 2, n(p, 'dishDepth') + 0.2, [
          0,
          0,
          v.height - n(p, 'dishDepth') / 2 + 0.1,
        ]),
      );
    body = cut(body, ...cuts);
  }
  return cut(body, ...v.grooveCenters.map((z) => groove(p, z)));
}
export function pistonComponents(p: Parameters, state: string): Component[] {
  const v = pistonValues(p),
    gap = n(p, 'explodedGap'),
    exploded = state === 'exploded';
  const components: Component[] = [
    {
      name: p.variant === 'pneumatic' ? 'Pneumatic piston body' : 'Piston body',
      color: 0xa9b0b9,
      solid: pistonBody(p),
      offset: [0, 0, 0],
    },
  ];
  if (state === 'body') return components;
  if (p.showRings)
    v.grooveCenters.forEach((z, i) => {
      const solid: Solid =
        p.variant === 'pneumatic'
          ? {
              kind: 'torus',
              major:
                v.radius -
                n(p, 'grooveDepth') +
                n(p, 'sealSection') / 2 +
                n(p, 'ringRadialClearance'),
              minor: n(p, 'sealSection') / 2,
              center: [0, 0, z],
            }
          : {
              kind: 'sector',
              outer: v.radius + n(p, 'ringProtrusion'),
              inner: v.radius - n(p, 'grooveDepth') + n(p, 'ringRadialClearance'),
              gap: n(p, 'ringGap'),
              height: n(p, 'grooveWidth') - 2 * n(p, 'ringSideClearance'),
              center: [0, 0, z],
              axis: 'z',
            };
      components.push({
        name: p.variant === 'pneumatic' ? `Seal ${i + 1}` : `Piston ring ${i + 1}`,
        color: p.variant === 'pneumatic' ? 0x272c33 : 0x4e5966,
        solid,
        offset: [
          0,
          0,
          exploded
            ? v.height +
              gap +
              (v.grooveCenters.length - 1 - i) * (n(p, 'grooveWidth') + gap * 0.5) -
              z
            : 0,
        ],
      });
    });
  if (p.variant !== 'pneumatic') {
    const pinOffset = exploded ? v.radius + gap + n(p, 'pinLength') / 2 : 0;
    if (p.showPin)
      components.push({
        name: 'Hollow wrist pin',
        color: 0xc1c8ce,
        solid: cut(
          cylinder(n(p, 'pinDiameter') / 2, n(p, 'pinLength'), [0, 0, v.pinZ], 'x'),
          cylinder(n(p, 'pinInnerDiameter') / 2, n(p, 'pinLength') + 0.2, [0, 0, v.pinZ], 'x'),
        ),
        offset: [pinOffset, 0, 0],
      });
    if (p.showClips)
      [-1, 1].forEach((sign) =>
        components.push({
          name: sign < 0 ? 'Wrist pin clip left' : 'Wrist pin clip right',
          color: 0x53606f,
          solid: {
            kind: 'sector',
            outer: v.clipOuter,
            inner: v.clipInner,
            gap: n(p, 'clipGap'),
            height: n(p, 'clipThickness'),
            center: [sign * v.clipX, 0, v.pinZ],
            axis: 'x',
          },
          offset: [
            exploded
              ? (sign < 0
                  ? -v.radius - gap - n(p, 'clipThickness') / 2
                  : pinOffset + n(p, 'pinLength') / 2 + gap + n(p, 'clipThickness') / 2) -
                sign * v.clipX
              : 0,
            0,
            0,
          ],
        }),
      );
  }
  return components;
}
