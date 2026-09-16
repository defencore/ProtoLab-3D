import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import {
  annulusPython,
  compoundPython,
  cylinder,
  DARK_STEEL,
  n,
  num,
  numberParameter,
  ring,
  sphere,
} from '../../core/geometry';
import { envelopeParameters, validateEnvelope } from './lib/parts/motion-bearing-utils';
import { motionSources } from './lib/catalog/motion-bearings';

function values(p: Parameters) {
  const R = n(p, 'outer') / 2,
    race = n(p, 'raceDiameter') / 2,
    band = R - race,
    C = n(p, 'outerWidth');
  return {
    R,
    race,
    C,
    roller: band * 0.22,
    pitch: race + band * 0.24,
    outerInner: race + band * 0.5,
    ball: band * 0.2,
  };
}
const part: PartDefinition = {
  id: 'combined-bearing',
  name: 'Combined needle and ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'COMBINED BEARINGS',
  icon: 'bearing',
  complexity: 'Radial + axial elements',
  description:
    'An NKIB-style combination of an axial ball row and a radial needle row around one shaft ring.',
  keywords: ['combined', 'needle', 'angular contact', 'axial', 'NKIB5903', 'NKIB5904'],
  parameters: [
    ...envelopeParameters,
    numberParameter('outerWidth', 'Outer ring width', 'C', 'Raceways', 1, 100),
    numberParameter('raceDiameter', 'Inner raceway diameter', 'F', 'Raceways', 2, 250),
    {
      ...numberParameter('rollers', 'Illustrative needle count', 'n', 'Internal layout', 5, 50, 1),
      unit: '',
    },
    {
      ...numberParameter('balls', 'Illustrative ball count', 'nb', 'Internal layout', 4, 30, 1),
      unit: '',
    },
  ],
  defaults: {
    bore: 17,
    outer: 30,
    width: 20,
    outerWidth: 18,
    raceDiameter: 22,
    rollers: 16,
    balls: 10,
  },
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width', 'outerWidth', 'raceDiameter'],
  sources: motionSources('combined-bearing'),
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p);
    if (v.race <= n(p, 'bore') / 2 + 0.2 || v.race >= v.R - 0.5)
      errors.push('The inner raceway must fit between the shaft bore and outer ring.');
    if (v.C >= n(p, 'width')) errors.push('Overall width must exceed outer-ring width.');
    for (const key of ['rollers', 'balls'])
      if (!Number.isInteger(n(p, key)))
        errors.push(`${key === 'balls' ? 'Ball' : 'Needle'} count must be an integer.`);
    if (2 * v.pitch * Math.sin(Math.PI / n(p, 'rollers')) <= 2 * v.roller)
      errors.push('Reduce needle count to avoid overlap.');
    if (2 * v.pitch * Math.sin(Math.PI / n(p, 'balls')) <= 2 * v.ball)
      errors.push('Reduce ball count to avoid overlap.');
    if (v.C * 0.15 <= v.ball)
      errors.push('Outer ring width must leave room for separate needle and ball rows.');
    return errors;
  },
  buildGeometry(p) {
    const group = new Group(),
      v = values(p);
    group.add(ring(v.race, n(p, 'bore') / 2, n(p, 'width')), ring(v.R, v.outerInner, v.C));
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'rollers'),
        roller = cylinder(v.roller, v.C * 0.6, DARK_STEEL);
      roller.position.set(v.pitch * Math.cos(a), v.pitch * Math.sin(a), -v.C * 0.18);
      group.add(roller);
    }
    for (let i = 0; i < n(p, 'balls'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'balls'),
        ball = sphere(v.ball, DARK_STEEL);
      ball.position.set(v.pitch * Math.cos(a), v.pitch * Math.sin(a), v.C * 0.35);
      group.add(ball);
    }
    return group;
  },
  python(p) {
    const v = values(p),
      shapes = [
        annulusPython(v.race, n(p, 'bore') / 2, n(p, 'width')),
        annulusPython(v.R, v.outerInner, v.C),
      ];
    for (let i = 0; i < n(p, 'rollers'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'rollers');
      shapes.push(
        `Part.makeCylinder(${num(v.roller)}, ${num(v.C * 0.6)}, App.Vector(${num(v.pitch * Math.cos(a))}, ${num(v.pitch * Math.sin(a))}, ${num(-v.C * 0.48)}))`,
      );
    }
    for (let i = 0; i < n(p, 'balls'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'balls');
      shapes.push(
        `Part.makeSphere(${num(v.ball)}, App.Vector(${num(v.pitch * Math.cos(a))}, ${num(v.pitch * Math.sin(a))}, ${num(v.C * 0.35)}))`,
      );
    }
    return compoundPython(shapes);
  },
  dimensions: (p) => [n(p, 'outer'), n(p, 'outer'), n(p, 'width')],
  notes:
    'NKIB envelope with verified inner raceway and outer-ring widths. The split inner ring, angular-contact raceways, needle geometry, counts and cage are represented schematically. The model is for integration, not load or contact simulation.',
};
export default { ...part, presets: modulePresets };
