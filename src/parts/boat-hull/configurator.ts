import type { ParameterDefinition, Parameters, PartDefinition } from '../../core/types';
export const defaults: Parameters = {
  layout: 'monohull',
  family: 'planing',
  bottom: 'v',
  length: 660,
  beam: 202,
  depth: 110,
  wall: 2,
  deadrise: 24,
  chineWidth: 85,
  midship: 55,
  sternWidth: 75,
  bow: 'raked',
  bowRake: 8,
  sternRake: 3,
  rocker: 12,
  sheer: 8,
  hullBeam: 100,
  centreBeam: 150,
  floatLength: 80,
  floatDepth: 75,
  asymmetry: 0,
  bridge: 'straight',
  crossbeam: 15,
  bridgeCurve: 6,
  cover: true,
};
const multi = (p: Parameters) => p.layout !== 'monohull';
const triple = (p: Parameters) => ['trimaran', 'pod-catamaran'].includes(String(p.layout));
const vee = (p: Parameters) => ['v', 'double-chine'].includes(String(p.bottom));
const num = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  unit = 'mm',
  visibleWhen?: ParameterDefinition['visibleWhen'],
): ParameterDefinition => ({
  key,
  label,
  type: 'number',
  group,
  min,
  max,
  unit,
  step: 0.1,
  ...(visibleWhen ? { visibleWhen } : {}),
});
export const parameters: ParameterDefinition[] = [
  {
    key: 'layout',
    label: 'Hull arrangement',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'monohull', label: 'Monohull · one hull' },
      { value: 'catamaran', label: 'Catamaran · two hulls' },
      { value: 'trimaran', label: 'Trimaran · main hull + outriggers' },
      { value: 'pod-catamaran', label: 'Catamaran · short central pod' },
    ],
  },
  {
    key: 'family',
    label: 'Longitudinal hull form',
    type: 'select',
    group: 'Configuration',
    options: [
      { value: 'displacement', label: 'Displacement-style · fine ends' },
      { value: 'semi-displacement', label: 'Semi-displacement-style · fuller stern' },
      { value: 'planing', label: 'Planing-style · broad transom' },
    ],
  },
  {
    key: 'bottom',
    label: 'Hull section',
    type: 'select',
    group: 'Section',
    options: [
      { value: 'flat', label: 'Flat bottom' },
      { value: 'v', label: 'Single-chine V-bottom' },
      { value: 'double-chine', label: 'Double-chine V-bottom' },
      { value: 'round', label: 'Round bottom' },
      { value: 'arch', label: 'Arched bottom · upright sides' },
      { value: 'soft-chine', label: 'Soft chine · semi-round bottom' },
    ],
  },
  num('deadrise', 'Deadrise at keel', 'Section', 3, 45, '°', vee),
  num('chineWidth', 'Chine / bottom width', 'Section', 50, 98, '%', (p) =>
    ['flat', 'v', 'double-chine'].includes(String(p.bottom)),
  ),
  num('length', 'Hull length', 'Dimensions', 150, 4000),
  num('beam', 'Overall beam', 'Dimensions', 40, 2500),
  num('depth', 'Midship depth below sheer', 'Dimensions', 20, 600),
  num('wall', 'Hull wall inset', 'Construction', 0.5, 15),
  num('midship', 'Maximum beam station from bow', 'Hull lines', 35, 65, '%'),
  num('sternWidth', 'Transom breadth / hull beam', 'Hull lines', 5, 100, '%'),
  num('rocker', 'End keel rise / depth', 'Hull lines', 0, 35, '%'),
  num('sheer', 'Bow sheer rise / depth', 'Hull lines', 0, 30, '%'),
  {
    key: 'bow',
    label: 'Stem shape',
    type: 'select',
    group: 'Bow & stern',
    options: [
      { value: 'plumb', label: 'Plumb stem' },
      { value: 'raked', label: 'Raked stem' },
      { value: 'spoon', label: 'Spoon bow' },
    ],
  },
  num(
    'bowRake',
    'Underwater bow setback / length',
    'Bow & stern',
    0,
    12,
    '%',
    (p) => p.bow !== 'plumb',
  ),
  num('sternRake', 'Underwater transom setback / length', 'Bow & stern', 0, 8, '%'),
  num('hullBeam', 'Outer hull / outrigger beam', 'Multihull', 20, 600, 'mm', multi),
  num('centreBeam', 'Centre hull / pod beam', 'Multihull', 30, 800, 'mm', triple),
  num(
    'floatLength',
    'Outrigger length / main hull',
    'Multihull',
    65,
    100,
    '%',
    (p) => p.layout === 'trimaran',
  ),
  num(
    'floatDepth',
    'Outrigger depth / main hull',
    'Multihull',
    50,
    100,
    '%',
    (p) => p.layout === 'trimaran',
  ),
  num('asymmetry', 'Outer-hull keel shift toward tunnel', 'Multihull', 0, 85, '%', multi),
  {
    key: 'bridge',
    label: 'Crossbeam form',
    type: 'select',
    group: 'Bridge',
    visibleWhen: multi,
    options: [
      { value: 'straight', label: 'Straight' },
      { value: 'raised', label: 'Arched · centre raised' },
      { value: 'lowered', label: 'Dished · centre lowered' },
      { value: 'none', label: 'Separate hulls · no crossbeams' },
    ],
  },
  num(
    'crossbeam',
    'Crossbeam width / height',
    'Bridge',
    5,
    80,
    'mm',
    (p) => multi(p) && p.bridge !== 'none',
  ),
  num(
    'bridgeCurve',
    'Crossbeam centre rise / drop',
    'Bridge',
    0,
    40,
    'mm',
    (p) => multi(p) && ['raised', 'lowered'].includes(String(p.bridge)),
  ),
  { key: 'cover', label: 'Removable midship covers', type: 'boolean', group: 'Construction' },
];
export const catalogSelection: NonNullable<PartDefinition['catalogSelection']> = [];
export function updateParameters(p: Parameters, key: string): Parameters {
  const next = { ...p };
  if (key === 'family')
    Object.assign(
      next,
      p.family === 'displacement'
        ? { bottom: 'round', sternWidth: 18, rocker: 25, bow: 'spoon' }
        : p.family === 'semi-displacement'
          ? { bottom: 'soft-chine', sternWidth: 55, rocker: 15, bow: 'raked' }
          : { bottom: 'v', sternWidth: 80, rocker: 4, bow: 'raked' },
    );
  if (key === 'layout' && p.layout !== 'monohull') {
    const triple = p.layout !== 'catamaran';
    next.beam = Math.max(
      Number(p.beam),
      Number(p.hullBeam) * 2 + (triple ? Number(p.centreBeam) : 0) + Number(p.hullBeam),
    );
  }
  if (
    (key === 'bottom' || key === 'family') &&
    ['v', 'double-chine'].includes(String(next.bottom))
  ) {
    const b =
      next.layout === 'monohull'
        ? Number(next.beam)
        : Math.max(
            Number(next.hullBeam),
            next.layout === 'catamaran' ? 0 : Number(next.centreBeam),
          );
    next.deadrise = Math.min(
      Number(next.deadrise),
      (Math.atan2(Number(next.depth) * 0.4, b / 2) * 180) / Math.PI,
    );
  }
  return Object.fromEntries(
    Object.entries(next).map(([k, v]) => [k, typeof v === 'number' ? Number(v.toFixed(3)) : v]),
  );
}
