import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import {
  bezier,
  choice,
  handedness,
  hasWireCollision,
  joinPaths,
  sample,
  tau,
  v,
  wireDimensions,
  wireGeometry,
  wireLoftPython,
} from './lib/core/spring-geometry';

const endOptions: [string, string][] = [
  ['eye', 'Full eye'],
  ['hook', 'Open hook'],
  ['side-eye', 'Side eye'],
  ['straight', 'Straight tail'],
];
function values(p: Parameters, state: string) {
  const w = n(p, 'wireDiameter'),
    r = (n(p, 'outerDiameter') - w) / 2,
    turns = n(p, 'turns');
  const height = n(p, 'bodyLength') - w + (state === 'extended' ? n(p, 'extension') : 0),
    hand = p.handedness === 'left' ? -1 : 1;
  const coil = sample(
    (t) =>
      v(
        r * Math.cos(hand * turns * tau * t),
        r * Math.sin(hand * turns * tau * t),
        (t - 0.5) * height,
      ),
    Math.ceil(turns * 32),
  );
  const end = (sign: number, style: string, rotation: number) => {
    const start = (sign < 0 ? coil[0] : coil[coil.length - 1]).clone();
    const theta = sign < 0 ? 0 : hand * turns * tau;
    const tangent = v(
      -sign * hand * r * Math.sin(theta),
      sign * hand * r * Math.cos(theta),
      (sign * height) / (tau * turns),
    ).normalize();
    const outward = v(0, 0, sign),
      R = (n(p, 'eyeDiameter') - w) / 2;
    const lead = n(p, 'endLength');
    if (style === 'straight') {
      const tip = start.clone().addScaledVector(outward, lead);
      return bezier(start, tangent, tip, outward, Math.min(lead / 2, r));
    }
    const angle = theta + (sign * hand * Math.PI) / 2 + (rotation * Math.PI) / 180;
    const horizontal = v(Math.cos(angle), Math.sin(angle), 0);
    const eyeStart =
      style === 'side-eye'
        ? start.clone().addScaledVector(outward, lead)
        : v(0, 0, start.z + sign * lead);
    const center = eyeStart.clone().addScaledVector(outward, R);
    const reach = Math.min(lead * 0.6, Math.max(2 * w, R));
    const connection = bezier(start, tangent, eyeStart, horizontal, reach);
    const sweep =
      style === 'hook'
        ? (n(p, 'hookAngle') * Math.PI) / 180
        : tau - Math.acos(Math.max(-0.8, 1 - (1.6 * w) / R));
    const loop = sample(
      (t) =>
        center
          .clone()
          .addScaledVector(horizontal, R * Math.cos(-Math.PI / 2 + sweep * t))
          .addScaledVector(outward, R * Math.sin(-Math.PI / 2 + sweep * t)),
      56,
    );
    return joinPaths(connection, loop);
  };
  const first = end(-1, String(p.endA), 0).reverse();
  const second = end(1, String(p.endB), n(p, 'endRotation'));
  return { w, r, height, turns, points: joinPaths(first, coil, second) };
}
const defaults = {
  outerDiameter: 14,
  wireDiameter: 1.5,
  bodyLength: 22,
  turns: 8,
  extension: 15,
  endA: 'eye',
  endB: 'eye',
  eyeDiameter: 12,
  endLength: 7,
  hookAngle: 210,
  endRotation: 0,
  handedness: 'right',
};
const part: PartDefinition = {
  id: 'extension-spring',
  name: 'Extension spring',
  category: 'SPRINGS',
  subgroup: 'HELICAL SPRINGS',
  icon: 'spring',
  complexity: '4 end styles',
  description:
    'A continuous tension spring with independent eyes, hooks or straight tails and rotated end planes.',
  keywords: ['spring', 'tension', 'extension', 'coil', 'hook', 'eye', 'loop', 'side eye'],
  parameters: [
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Coil', 4, 120),
    numberParameter('wireDiameter', 'Wire diameter', 'd', 'Coil', 0.4, 10),
    { ...numberParameter('turns', 'Body turns', 'n', 'Coil', 2, 30, 1), unit: '' },
    handedness,
    choice('endA', 'First end', 'Ends', endOptions),
    choice('endB', 'Second end', 'Ends', endOptions),
    {
      ...numberParameter('eyeDiameter', 'Eye / hook outside diameter', 'E', 'Ends', 3, 100),
      visibleWhen: (p) => p.endA !== 'straight' || p.endB !== 'straight',
    },
    numberParameter('endLength', 'Lead / tail length', 'a', 'Ends', 2, 100),
    {
      ...numberParameter('hookAngle', 'Open hook sweep', 'α', 'Ends', 120, 290, 5),
      unit: '°',
      visibleWhen: (p) => p.endA === 'hook' || p.endB === 'hook',
    },
    {
      ...numberParameter('endRotation', 'Second end plane rotation', 'β', 'Ends', 0, 180, 15),
      unit: '°',
      visibleWhen: (p) => p.endB !== 'straight',
      description: '0° aligns the end planes; 90° makes them perpendicular.',
    },
    numberParameter('bodyLength', 'Free body length', 'L', 'Travel', 5, 250),
    {
      ...numberParameter('extension', 'Extension travel', 'x', 'Travel', 0, 250),
      visibleWhen: (_, state) => state === undefined || state === 'extended',
    },
  ],
  presetMatchKeys: ['outerDiameter', 'wireDiameter', 'endA', 'endB'],
  defaults,
  presets: modulePresets,
  states: [
    { id: 'relaxed', label: 'Free', description: 'Unloaded body length' },
    {
      id: 'extended',
      label: 'Extended',
      description: 'Body length increased by the specified travel',
    },
  ],
  validate(p, s) {
    const { r, w, height, turns, points } = values(p, s),
      errors: string[] = [];
    if (r <= w) errors.push('Outside diameter must exceed three wire diameters.');
    if (!Number.isInteger(turns)) errors.push('Body turns must be a whole number.');
    if (height / turns <= w * 1.08)
      errors.push('Body length is too short for the wire diameter and turn count.');
    if ((p.endA !== 'straight' || p.endB !== 'straight') && n(p, 'eyeDiameter') < 5 * w)
      errors.push('Eye / hook diameter must be at least five wire diameters.');
    if (n(p, 'endLength') < Math.max(3 * w, r * 0.7))
      errors.push(
        'Lead length must be at least three wire diameters and 35% of the mean coil diameter.',
      );
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
    return wireLoftPython(points, w);
  },
  dimensions(p, s) {
    const { points, w } = values(p, s);
    return wireDimensions(points, w);
  },
  notes:
    'One continuous round-wire solid lofted through circular sections along the preview curve. Its surface is segmented along the path. Full eyes retain an opening with clearance from the lead; they are not welded closed. The body has clearance between coils; initial tension, force, stress and hook-forming allowances are not calculated.',
  sources: [
    {
      label: 'Extension spring variants — GrabCAD reference',
      url: 'https://grabcad.com/library/different-types-of-tension-extension-springs-1',
    },
  ],
};
export default { ...part, presets: modulePresets };
