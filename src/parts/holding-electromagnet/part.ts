import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presetData from './presets.json';
import { component, cylinder, difference, pythonShape, revolved, type Shape } from './lib/shapes';

type Component = {
  label: string;
  color: number;
  rgb: [number, number, number];
  shape: Shape;
};
const includesArmature = (state: string) => state === 'assembled' || state === 'exploded';
const plateZ = (p: Parameters, state: string) =>
  n(p, 'bodyHeight') + n(p, 'airGap') + (state === 'exploded' ? n(p, 'bodyHeight') * 0.8 : 0);

function components(p: Parameters, state: string): Component[] {
  const radius = n(p, 'bodyDiameter') / 2;
  const height = n(p, 'bodyHeight');
  const innerRadius = radius - n(p, 'wallThickness');
  const back = n(p, 'backThickness');
  const poleRadius = n(p, 'poleDiameter') / 2;
  const boreRadius = n(p, 'mountingBoreDiameter') / 2;
  const clearance = n(p, 'coilClearance');
  const coilBase = back + clearance;
  const coilTop = height - n(p, 'coilRecess');
  const leadRadius = n(p, 'leadDiameter') / 2;
  const leadX = (innerRadius + poleRadius) / 2;

  // This one section defines the full fused steel cup, pole and genuine blind bore.
  let cup: Shape = revolved([
    [boreRadius, 0],
    [radius, 0],
    [radius, height],
    [innerRadius, height],
    [innerRadius, back],
    [poleRadius, back],
    [poleRadius, height],
    [0, height],
    [0, n(p, 'mountingBoreDepth')],
    [boreRadius, n(p, 'mountingBoreDepth')],
  ]);
  if (p.showLeads === true) {
    const portRadius = leadRadius + clearance / 2;
    cup = difference(
      cup,
      cylinder(portRadius, back + 2, [leadX, 0, -1]),
      cylinder(portRadius, back + 2, [-leadX, 0, -1]),
    );
  }
  const coil = revolved([
    [poleRadius + clearance, coilBase],
    [innerRadius - clearance, coilBase],
    [innerRadius - clearance, coilTop],
    [poleRadius + clearance, coilTop],
  ]);
  const result: Component[] = [
    {
      label: 'Steel cup',
      color: 0x85898e,
      rgb: [0.522, 0.537, 0.557],
      shape: cup,
    },
    {
      label: 'Potted coil',
      color: 0x9a512c,
      rgb: [0.604, 0.318, 0.173],
      shape: coil,
    },
  ];
  if (includesArmature(state))
    result.push({
      label: 'Armature plate',
      color: 0xb3b8bd,
      rgb: [0.702, 0.722, 0.741],
      shape: cylinder(n(p, 'armatureDiameter') / 2, n(p, 'armatureThickness'), [
        0,
        0,
        plateZ(p, state),
      ]),
    });
  if (p.showLeads === true) {
    const length = n(p, 'leadLength');
    result.push(
      {
        label: 'Positive lead',
        color: 0xbb342c,
        rgb: [0.733, 0.204, 0.173],
        shape: cylinder(leadRadius, length + coilBase, [leadX, 0, -length]),
      },
      {
        label: 'Negative lead',
        color: 0x282b30,
        rgb: [0.157, 0.169, 0.188],
        shape: cylinder(leadRadius, length + coilBase, [-leadX, 0, -length]),
      },
    );
  }
  return result;
}

const part: PartDefinition = {
  id: 'holding-electromagnet',
  name: 'Holding electromagnet',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'HOLDING MAGNETS',
  icon: 'magnet',
  complexity: 'Pot core, potted coil, rear mounting and removable armature',
  description:
    'Round pot holding electromagnet with an annular coil, blind mounting bore, removable keeper plate and optional rear leads.',
  keywords: [
    'electromagnet',
    'holding magnet',
    'pot magnet',
    'coil',
    'keeper',
    'armature',
    'magnetic clamp',
  ],
  parameters,
  defaults,
  presets: presetData as Preset[],
  presetMatchKeys: ['bodyDiameter', 'bodyHeight', 'mountingBoreDiameter', 'armatureDiameter'],
  states: [
    {
      id: 'magnet-only',
      label: 'Magnet only',
      description: 'Expose the annular coil and concentric pole faces.',
    },
    {
      id: 'assembled',
      label: 'With armature',
      description: 'Add the removable armature plate at the configured working air gap.',
    },
    {
      id: 'exploded',
      label: 'Exploded armature',
      description:
        'Lift the armature by an additional 80% of the cup height to show the pole faces.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      const value = p[field.key];
      if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value))
          errors.push(`${field.label} must be a finite number.`);
        else if (value < field.min! || value > field.max!)
          errors.push(`${field.label} must be between ${field.min} and ${field.max} mm.`);
      } else if (field.type === 'boolean' && typeof value !== 'boolean')
        errors.push(`${field.label} must be enabled or disabled.`);
    }
    if (!['magnet-only', 'assembled', 'exploded'].includes(state))
      errors.push('Choose a supported magnet state.');
    if (errors.length) return errors;
    const radius = n(p, 'bodyDiameter') / 2;
    const innerRadius = radius - n(p, 'wallThickness');
    const poleRadius = n(p, 'poleDiameter') / 2;
    const clearance = n(p, 'coilClearance');
    const annulusWidth = innerRadius - poleRadius;
    const height = n(p, 'bodyHeight');
    if (annulusWidth - 2 * clearance < 0.8)
      errors.push('Leave at least 0.8 mm of radial coil width after both clearances.');
    if (height - n(p, 'backThickness') - clearance - n(p, 'coilRecess') < 0.8)
      errors.push('Leave at least 0.8 mm of coil height above the back plate.');
    if (poleRadius - n(p, 'mountingBoreDiameter') / 2 < 0.8)
      errors.push('Keep at least 0.8 mm of steel around the central mounting bore.');
    if (height - n(p, 'mountingBoreDepth') < 0.8)
      errors.push(
        'The rear mounting bore must remain blind with at least 0.8 mm of steel at the pole face.',
      );
    if (n(p, 'armatureDiameter') < n(p, 'bodyDiameter'))
      errors.push(
        'The armature diameter must cover both the central pole and the outer pole face.',
      );
    if (p.showLeads === true && n(p, 'leadDiameter') + 2 * clearance >= annulusWidth)
      errors.push('The rear leads must fit beneath the annular coil with radial clearance.');
    return errors;
  },
  buildGeometry(p, state) {
    return new Group().add(
      ...components(p, state).map((c) => component(c.shape, c.label, c.color)),
    );
  },
  python(p, state) {
    const entries = components(p, state);
    return [
      ...entries.map((c, i) => `component_${i} = ${pythonShape(c.shape)}.removeSplitter()`),
      `shape = Part.makeCompound([${entries.map((_, i) => `component_${i}`).join(', ')}])`,
      `component_labels = ${JSON.stringify(entries.map((c) => c.label))}`,
      `component_colors = ${JSON.stringify(entries.map((c) => c.rgb))}`,
    ].join('\n');
  },
  dimensions(p, state) {
    const diameter = Math.max(
      n(p, 'bodyDiameter'),
      includesArmature(state) ? n(p, 'armatureDiameter') : 0,
    );
    const top = includesArmature(state)
      ? plateZ(p, state) + n(p, 'armatureThickness')
      : n(p, 'bodyHeight');
    return [diameter, diameter, top + (p.showLeads === true ? n(p, 'leadLength') : 0)];
  },
  notes:
    'Geometric prototype, in millimetres. The rear mounting face is Z=0 and the working pole face is +Z. The coil is a single potted winding envelope, leads are insulated envelopes, and the mounting bore is smooth. Presets are editable examples with no manufacturer, voltage, current, thermal or holding-force rating. The air gap changes placement only; no magnetic simulation is performed.',
};

export default part;
