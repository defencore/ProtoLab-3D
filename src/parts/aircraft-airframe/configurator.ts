import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
export const defaults: Parameters = {
  layout: 'conventional',
  wingMount: 'high',
  wingStation: 34,
  wingThickness: 12,
  wingControl: 'ailerons',
  controlChord: 26,
  hingeGap: 0.4,
  winglets: true,
  foreplaneControl: true,
  length: 900,
  bodyWidth: 90,
  bodyHeight: 105,
  wall: 2,
  span: 1200,
  rootChord: 220,
  tipChord: 160,
  sweep: 4,
  dihedral: 3,
  tail: 'conventional',
  tailSpan: 380,
  tailChord: 135,
  finHeight: 135,
};
export const parameters: ParameterDefinition[] = [
  {
    key: 'layout',
    label: 'Airframe configuration',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'conventional', label: 'Conventional fuselage' },
      { value: 'glider', label: 'Glider / sailplane' },
      { value: 'flying-wing', label: 'Flying wing · centre equipment bay' },
      { value: 'delta', label: 'Delta wing · rear fin' },
      { value: 'canard', label: 'Canard · forward horizontal surfaces' },
      { value: 'twin-boom', label: 'Twin boom · H-tail' },
      { value: 'tandem', label: 'Tandem · two lifting wings' },
    ],
  },
  {
    key: 'wingMount',
    label: 'Wing position on fuselage',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'high', label: 'High wing' },
      { value: 'mid', label: 'Mid wing' },
      { value: 'low', label: 'Low wing' },
    ],
    visibleWhen: (p) => p.layout !== 'flying-wing',
  },
  {
    key: 'wingStation',
    label: 'Root leading edge from nose',
    type: 'number',
    group: 'Wing',
    min: 12,
    max: 65,
    step: 1,
    unit: '%',
    visibleWhen: (p) => p.layout !== 'flying-wing',
  },
  {
    key: 'wingThickness',
    label: 'Wing thickness / chord',
    type: 'number',
    group: 'Wing',
    min: 6,
    max: 20,
    step: 0.5,
    unit: '%',
  },
  {
    key: 'foreplaneControl',
    label: 'Moving canard elevators',
    type: 'boolean',
    group: 'Controls',
    visibleWhen: (p) => p.layout === 'canard',
  },
  {
    key: 'winglets',
    label: 'Wingtip fins',
    type: 'boolean',
    group: 'Tail',
    visibleWhen: (p) => p.layout === 'flying-wing',
  },
  {
    key: 'wingControl',
    label: 'Wing control surfaces',
    type: 'select',
    group: 'Controls',
    options: [
      { value: 'ailerons', label: 'Ailerons · roll' },
      { value: 'flaps-ailerons', label: 'Flaps + ailerons · lift / roll' },
      { value: 'flaperons', label: 'Flaperons · combined lift / roll' },
      { value: 'elevons', label: 'Elevons · combined pitch / roll' },
      { value: 'none', label: 'No wing controls · rudder / elevator' },
    ],
  },
  {
    key: 'controlChord',
    label: 'Control surface chord',
    type: 'number',
    group: 'Controls',
    min: 15,
    max: 35,
    step: 1,
    unit: '%',
  },
  {
    key: 'hingeGap',
    label: 'Illustrative hinge clearance',
    type: 'number',
    group: 'Controls',
    min: 0.1,
    max: 2,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'length',
    label: 'Fuselage length',
    type: 'number',
    group: 'Dimensions',
    min: 150,
    max: 5000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'bodyWidth',
    label: 'Body / centre-section width',
    type: 'number',
    group: 'Dimensions',
    min: 25,
    max: 700,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'bodyHeight',
    label: 'Fuselage height',
    type: 'number',
    group: 'Dimensions',
    min: 25,
    max: 700,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'wall',
    label: 'Shell thickness',
    type: 'number',
    group: 'Construction',
    min: 0.3,
    max: 15,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'span',
    label: 'Wingspan',
    type: 'number',
    group: 'Dimensions',
    min: 200,
    max: 8000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'rootChord',
    label: 'Wing root chord',
    type: 'number',
    group: 'Dimensions',
    min: 30,
    max: 1000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'tipChord',
    label: 'Wing tip chord',
    type: 'number',
    group: 'Dimensions',
    min: 15,
    max: 1000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'sweep',
    label: 'Wing leading-edge sweep',
    type: 'number',
    group: 'Wing',
    min: -25,
    max: 70,
    step: 0.1,
    unit: '\u00b0',
  },
  {
    key: 'dihedral',
    label: 'Wing dihedral',
    type: 'number',
    group: 'Wing',
    min: 0,
    max: 15,
    step: 0.1,
    unit: '\u00b0',
  },
  {
    key: 'tail',
    label: 'Tail arrangement',
    type: 'select',
    group: 'Construction',
    options: [
      { value: 'conventional', label: 'Conventional tail' },
      { value: 'v-tail', label: 'V-tail' },
      { value: 't-tail', label: 'T-tail' },
      { value: 'none', label: 'Tailless' },
    ],
  },
  {
    key: 'tailSpan',
    label: 'Tail / foreplane span',
    type: 'number',
    group: 'Tail',
    min: 50,
    max: 2000,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'tailChord',
    label: 'Tail / foreplane chord',
    type: 'number',
    group: 'Tail',
    min: 20,
    max: 600,
    step: 0.1,
    unit: 'mm',
  },
  {
    key: 'finHeight',
    label: 'Vertical tail height',
    type: 'number',
    group: 'Tail',
    min: 20,
    max: 800,
    step: 0.1,
    unit: 'mm',
  },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];

for (const field of parameters) {
  if (['tailSpan', 'tailChord'].includes(field.key)) field.visibleWhen = (p) => p.tail !== 'none';
  if (field.key === 'finHeight')
    field.visibleWhen = (p) =>
      p.tail !== 'v-tail' && (p.layout !== 'flying-wing' || Boolean(p.winglets));
  if (['length', 'bodyHeight'].includes(field.key))
    field.visibleWhen = (p) => p.layout !== 'flying-wing';
  if (field.key === 'tail')
    field.visibleWhen = (p) => ['conventional', 'glider'].includes(String(p.layout));
}

/** Changing the topology selects a coherent starting configuration; dimensions remain editable. */
export function updateParameters(p: Parameters, key: string): Parameters {
  if (key !== 'layout') return p;
  const configurations: Record<string, Parameters> = {
    conventional: { tail: 'conventional', wingStation: 34, wingControl: 'ailerons', sweep: 4 },
    glider: { tail: 't-tail', wingStation: 34, wingControl: 'flaps-ailerons', sweep: 4 },
    'flying-wing': { tail: 'none', wingMount: 'mid', wingControl: 'elevons', sweep: 25 },
    delta: { tail: 'none', wingMount: 'mid', wingStation: 32, wingControl: 'elevons', sweep: 50 },
    canard: { tail: 'conventional', wingStation: 55, wingControl: 'ailerons', sweep: 12 },
    'twin-boom': {
      tail: 'conventional',
      wingMount: 'mid',
      wingStation: 28,
      wingControl: 'ailerons',
      sweep: 0,
    },
    tandem: {
      tail: 'conventional',
      wingStation: 18,
      wingControl: 'ailerons',
      sweep: 0,
      tailSpan: Number(p.span) * 0.8,
      tailChord: Number(p.rootChord) * 0.85,
    },
  };
  const next = { ...p, ...configurations[String(p.layout)] };
  const length = Number(p.length),
    width = Number(p.bodyWidth);
  if (p.layout === 'flying-wing') {
    next.wall = Math.min(Number(p.wall), (Number(p.rootChord) * Number(p.wingThickness)) / 1000);
  } else {
    next.rootChord = Math.min(Number(p.rootChord), length * (p.layout === 'canard' ? 0.25 : 0.33));
    next.tailChord = Math.min(Number(next.tailChord), length * 0.18);
    next.tipChord = Math.min(Number(p.tipChord), Number(next.rootChord));
    next.tailSpan = Math.max(width * 1.6, Math.min(Number(next.tailSpan), Number(p.span) * 0.65));
    if (p.layout === 'canard') next.foreplaneControl = true;
    if (p.layout === 'delta') {
      next.rootChord = length * 0.52;
      next.tipChord = Math.max(15, Number(next.rootChord) * 0.07);
      next.sweep =
        (Math.atan2(Number(next.rootChord) - Number(next.tipChord), Number(p.span) / 2) * 180) /
        Math.PI;
      next.dihedral = 0;
    }
    if (p.layout === 'glider') {
      next.bodyWidth = Math.min(width, length * 0.065);
      next.bodyHeight = Math.min(Number(p.bodyHeight), length * 0.085);
    }
  }
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [
      key,
      typeof value === 'number' ? Number(value.toFixed(3)) : value,
    ]),
  );
}
