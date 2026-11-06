import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import type { Shape } from '../../core/assembly/boundary/shapes';
import detail from '../manufactured-detail/part';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection } from './configurator';
import profile from './product.json';
import presets from './presets.json';

export function buttonShape(p: Parameters): Shape {
  const r = n(p, 'flangeDiameter') / 2;
  const neck = n(p, 'neckDiameter') / 2;
  const bore = n(p, 'bore') / 2;
  const recess = n(p, 'counterbore') / 2;
  const h = n(p, 'height');
  const t = n(p, 'flangeThickness');
  const bottom = -h / 2;
  const top = h / 2;
  return {
    kind: 'revolve',
    segments: 96,
    profile: [
      [bore, bottom],
      [r, bottom],
      [r, bottom + t],
      [neck, bottom + t],
      [neck, top - t],
      [r, top - t],
      [r, top],
      [recess, top],
      [recess, top - n(p, 'counterboreDepth')],
      [bore, top - n(p, 'counterboreDepth')],
    ],
  };
}

const configured = (p: Parameters): Parameters => ({
  ...detail.defaults,
  recipe: JSON.stringify(buttonShape(p)),
});

const part: PartDefinition = {
  id: 'rocket-rail-button',
  name: 'Rocket rail guide button',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'rail',
  complexity: 'Turned polymer prototype',
  description:
    'Configurable two-flange rail button with an axial screw clearance bore and recessed head seat for hobby rocket layout and measured rail fitting.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'rail guide',
    'launch guide',
    '1010',
    '1515',
    'button',
    '\u043d\u0430\u043f\u0440\u044f\u043c\u043d\u0430',
    '\u0440\u0430\u043a\u0435\u0442\u0430',
  ],
  product: profile as ProductProfile,
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection,
  presetMatchKeys: ['flangeDiameter', 'neckDiameter', 'height', 'bore'],
  validate(p) {
    const errors = parameters
      .filter(
        (field) =>
          typeof p[field.key] !== 'number' ||
          !Number.isFinite(p[field.key]) ||
          +p[field.key] < field.min! ||
          +p[field.key] > field.max!,
      )
      .map((field) => `${field.label} is outside its allowed finite range.`);
    if (errors.length) return errors;
    if (n(p, 'flangeDiameter') - n(p, 'neckDiameter') < 1)
      errors.push('Flanges must project at least 0.5 mm radially beyond the groove root.');
    if (n(p, 'neckDiameter') - n(p, 'bore') < 2)
      errors.push('Keep at least 1 mm radial material around the screw bore at the groove root.');
    if (n(p, 'height') - 2 * n(p, 'flangeThickness') < 1)
      errors.push('Leave at least 1 mm axial groove width between the flanges.');
    if (n(p, 'counterbore') <= n(p, 'bore'))
      errors.push('The screw head recess must be wider than the through bore.');
    if (n(p, 'flangeDiameter') - n(p, 'counterbore') < 2)
      errors.push('Keep at least 1 mm radial material around the screw head recess.');
    if (n(p, 'counterboreDepth') > n(p, 'flangeThickness') - 0.5)
      errors.push('Keep at least 0.5 mm of head-seat material within the upper flange.');
    return errors;
  },
  buildGeometry: (p, state) => detail.buildGeometry(configured(p), state),
  buildExportGeometry: (p, state) => detail.buildExportGeometry!(configured(p), state),
  python: (p, state) => detail.python(configured(p), state),
  dimensions: (p) => [n(p, 'flangeDiameter'), n(p, 'flangeDiameter'), n(p, 'height')],
  assessment: (p) => [
    `Axial groove width ${(n(p, 'height') - 2 * n(p, 'flangeThickness')).toFixed(2)} mm; groove root D${p.neckDiameter}; screw bore D${p.bore}. Compare all three against the actual rail and fastener.`,
    'One polymer body only. The screw, backing nut, airframe reinforcement and second button are separate project items.',
  ],
  validationNotice: 'Prototype groove and mounting dimensions; measure the actual rail before use.',
  notes:
    'Z is the screw axis; the mounting face is at -H/2. One continuous revolved body, through bore and flat-bottom head recess. The small and large presets borrow only the rounded metric outside envelopes printed by Apogee; the page also gives rounded inch values. Internal geometry is authored and does not establish compatibility with 1010 or 1515 rails. These are prototype examples, not verified supplier replicas or a complete mounting kit.',
  sources: [
    {
      label: 'Apogee rail-button outside-envelope comparison and mounting context',
      url: 'https://apogeerockets.com/building_supplies/rail_buttons/1in_1010_rail_button_standard',
    },
  ],
};

export default part;
