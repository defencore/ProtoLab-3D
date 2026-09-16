import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import {
  choice,
  handedness,
  hasWireCollision,
  joinPaths,
  sample,
  tau,
  v,
  wireDimensions,
  wireGeometry,
  wirePython,
} from './lib/core/spring-geometry';
import type { Vector3 } from 'three';

/** Tangential legs join the coil continuously; bends have an explicit centreline radius. */
export function torsionLeg(
  start: Vector3,
  tangent: Vector3,
  radial: Vector3,
  length: number,
  style: string,
  bendAngle: number,
  bendRadius: number,
  tipLength: number,
): Vector3[] {
  const lead = sample(
    (t) => start.clone().addScaledVector(tangent, t * length),
    Math.max(4, Math.ceil(length / 2)),
  );
  if (style === 'straight') return lead;
  const target =
    style === 'axial'
      ? v(0, 0, Math.sign(tangent.z) || 1)
      : radial.clone().multiplyScalar(style === 'inward' ? -1 : 1);
  const direction = target.addScaledVector(tangent, -target.dot(tangent)).normalize();
  const base = lead[lead.length - 1],
    angle = (bendAngle * Math.PI) / 180;
  const bend = sample(
    (t) =>
      base
        .clone()
        .addScaledVector(tangent, bendRadius * Math.sin(angle * t))
        .addScaledVector(direction, bendRadius * (1 - Math.cos(angle * t))),
    20,
  );
  const finish = bend[bend.length - 1],
    endTangent = tangent
      .clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(direction, Math.sin(angle));
  const tail = sample((t) => finish.clone().addScaledVector(endTangent, tipLength * t), 6);
  return joinPaths(lead, bend, tail);
}
const legStyles: [string, string][] = [
  ['straight', 'Straight'],
  ['inward', 'Bend toward axis'],
  ['outward', 'Bend away from axis'],
  ['axial', 'Axial bend'],
];
function values(p: Parameters, state: string) {
  const w = n(p, 'wireDiameter'),
    originalTurns = n(p, 'turns') + n(p, 'legAngle') / 360;
  const turns =
    originalTurns +
    ((state === 'wound' ? 1 : state === 'unwound' ? -1 : 0) * n(p, 'deflection')) / 360;
  const r = (((n(p, 'outerDiameter') - w) / 2) * originalTurns) / turns,
    h = originalTurns * w * 1.3;
  const hand = p.handedness === 'left' ? -1 : 1;
  const coil = sample(
    (t) =>
      v(r * Math.cos(hand * turns * tau * t), r * Math.sin(hand * turns * tau * t), (t - 0.5) * h),
    Math.ceil(turns * 32),
  );
  const leg = (sign: number, suffix: string) => {
    const angle = sign < 0 ? 0 : hand * tau * turns;
    const start = sign < 0 ? coil[0] : coil[coil.length - 1];
    const tangent = v(
      -sign * hand * r * Math.sin(angle),
      sign * hand * r * Math.cos(angle),
      (sign * h) / (tau * turns),
    ).normalize();
    return torsionLeg(
      start,
      tangent,
      v(Math.cos(angle), Math.sin(angle), 0),
      n(p, `legLength${suffix}`),
      String(p[`legEnd${suffix}`]),
      n(p, 'bendAngle'),
      n(p, 'bendRadius'),
      n(p, 'tipLength'),
    );
  };
  return { w, r, h, turns, points: joinPaths(leg(-1, 'A').reverse(), coil, leg(1, 'B')) };
}
const defaults = {
  outerDiameter: 18,
  wireDiameter: 1.5,
  turns: 4,
  legAngle: 90,
  legLengthA: 30,
  legLengthB: 25,
  legEndA: 'straight',
  legEndB: 'straight',
  deflection: 60,
  handedness: 'right',
  bendAngle: 90,
  bendRadius: 3,
  tipLength: 8,
};
const hasBends = (p: Parameters) => p.legEndA !== 'straight' || p.legEndB !== 'straight';
const part: PartDefinition = {
  id: 'torsion-spring',
  name: 'Torsion spring',
  category: 'SPRINGS',
  subgroup: 'TORSION SPRINGS',
  icon: 'spring',
  complexity: '3 states',
  description:
    'Single-coil torsion spring with independent leg lengths, tangential and bent tips, and both winding directions.',
  keywords: ['spring', 'torsion', 'hinge', 'winding', 'leg', 'coil', 'bent leg', 'angular'],
  parameters: [
    numberParameter('outerDiameter', 'Free outside diameter', 'D', 'Coil', 5, 120),
    numberParameter('wireDiameter', 'Wire diameter', 'd', 'Coil', 0.4, 10),
    { ...numberParameter('turns', 'Whole body turns', 'n', 'Coil', 2, 20, 1), unit: '' },
    {
      ...numberParameter('legAngle', 'Additional coil angle', 'α', 'Coil', 0, 355, 5),
      unit: '°',
      description: 'Rotates the second leg independently of the whole turn count.',
    },
    handedness,
    numberParameter('legLengthA', 'First straight leg', 'A', 'Legs', 3, 200),
    numberParameter('legLengthB', 'Second straight leg', 'B', 'Legs', 3, 200),
    choice('legEndA', 'First leg end', 'Legs', legStyles),
    choice('legEndB', 'Second leg end', 'Legs', legStyles),
    {
      ...numberParameter('bendRadius', 'Bend centreline radius', 'R', 'Legs', 1, 40),
      visibleWhen: hasBends,
    },
    {
      ...numberParameter('bendAngle', 'Tip bend angle', 'β', 'Legs', 15, 135, 5),
      unit: '°',
      visibleWhen: hasBends,
    },
    {
      ...numberParameter('tipLength', 'Bent tip length', 'C', 'Legs', 2, 80),
      visibleWhen: hasBends,
    },
    {
      ...numberParameter('deflection', 'State deflection', 'θ', 'Travel', 5, 270, 5),
      visibleWhen: (_, state) => state === undefined || state !== 'relaxed',
      unit: '°',
    },
  ],
  presetMatchKeys: ['outerDiameter', 'wireDiameter'],
  defaults,
  presets: modulePresets,
  states: [
    { id: 'relaxed', label: 'Free', description: 'Original coil and leg positions' },
    { id: 'wound', label: 'Wound', description: 'Additional winding reduces mean coil diameter' },
    {
      id: 'unwound',
      label: 'Unwound',
      description: 'Reduced winding increases mean coil diameter',
    },
  ],
  validate(p, s) {
    const { r, w, h, turns, points } = values(p, s),
      errors: string[] = [];
    if (r <= w) errors.push('Coil diameter is too small for this wire and state.');
    if (!Number.isInteger(n(p, 'turns')))
      errors.push(
        'Whole body turns must be an integer; use the additional coil angle for leg orientation.',
      );
    if (h / turns <= 1.08 * w)
      errors.push(
        'Winding closes the coil clearance. Reduce deflection or increase the turn count.',
      );
    if (hasBends(p) && n(p, 'bendRadius') < w * 1.5)
      errors.push('Bend centreline radius must be at least 1.5 wire diameters.');
    if (Math.min(n(p, 'legLengthA'), n(p, 'legLengthB')) < 2 * w)
      errors.push('Each straight leg must be at least two wire diameters long.');
    if (!errors.length && hasWireCollision(points, w))
      errors.push(
        'The selected ends or legs intersect the spring wire. Increase their spacing or change the end orientation.',
      );
    return errors;
  },
  buildGeometry(p, s) {
    const { points, w } = values(p, s);
    return wireGeometry(points, w);
  },
  python(p, s) {
    const { points, w } = values(p, s);
    return wirePython(points, w);
  },
  dimensions(p, s) {
    const { points, w } = values(p, s);
    return wireDimensions(points, w);
  },
  notes:
    'One continuous swept wire with tangential legs. State changes preserve approximate circumferential wire length and body height. This geometry does not predict torque, stress, fatigue or material behaviour.',
  sources: [
    {
      label: 'Torsion spring — GrabCAD reference',
      url: 'https://grabcad.com/library/torsion-spring-23',
    },
  ],
};
export default { ...part, presets: modulePresets };
