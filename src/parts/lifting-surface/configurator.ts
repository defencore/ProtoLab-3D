import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const profileOptions = [
  { value: 'naca23012', label: 'NACA 23012 · UIUC coordinates' },
  { value: 'e387', label: 'Eppler E387 · UIUC coordinates' },
  { value: 's1223', label: 'Selig S1223 · UIUC coordinates' },
  { value: 'naca0006', label: 'NACA 0006 · symmetric, 6%' },
  { value: 'naca0009', label: 'NACA 0009 · symmetric, 9%' },
  { value: 'naca0012', label: 'NACA 0012 · symmetric, 12%' },
  { value: 'naca0015', label: 'NACA 0015 · symmetric, 15%' },
  { value: 'naca0018', label: 'NACA 0018 · symmetric, 18%' },
  { value: 'naca2412', label: 'NACA 2412 · cambered, 12%' },
  { value: 'naca4412', label: 'NACA 4412 · cambered, 12%' },
  { value: 'naca-custom', label: 'NACA 4-series · custom' },
  { value: 'diamond', label: 'Double wedge · sharp leading edge' },
  { value: 'biconvex', label: 'Biconvex · opposed circular arcs' },
];
export const defaults: Parameters = {
  layout: 'pair',
  orientation: 'horizontal',
  planform: 'trapezoid',
  semiSpan: 300,
  rootChord: 160,
  tipChord: 80,
  rootGap: 0,
  sweep: 12,
  outerSweep: 25,
  kinkPosition: 50,
  kinkChord: 110,
  dihedral: 3,
  incidence: 0,
  twist: -2,
  rootProfile: 'naca2412',
  tipProfile: 'naca0012',
  rootThickness: 12,
  rootCamber: 2,
  rootCamberPosition: 40,
  tipThickness: 8,
  tipCamber: 0,
  tipCamberPosition: 40,
  wedgePosition: 50,
  trailingEdge: 0,
  spanSegments: 12,
  profileSegments: 40,
  sectionDepth: 5,
};
const select = (
  key: string,
  label: string,
  group: string,
  options: { value: string; label: string }[],
): ParameterDefinition => ({ key, label, type: 'select', group, options });
const number = (
  key: string,
  label: string,
  symbol: string,
  group: string,
  min: number,
  max: number,
  unit = 'mm',
  step = 0.1,
): ParameterDefinition => ({ ...numberParameter(key, label, symbol, group, min, max), unit, step });
const profileFields = (end: 'root' | 'tip'): ParameterDefinition[] => {
  const title = end === 'root' ? 'Root profile' : 'Tip profile';
  const active = (p: Parameters) => p[`${end}Profile`] !== 'same';
  const custom = (p: Parameters) =>
    active(p) && ['naca-custom', 'diamond', 'biconvex'].includes(String(p[`${end}Profile`]));
  return [
    select(
      `${end}Profile`,
      title,
      title,
      end === 'tip'
        ? [{ value: 'same', label: 'Same as root' }, ...profileOptions]
        : profileOptions,
    ),
    {
      ...number(`${end}Thickness`, 'Thickness / chord', 't/c', title, 2, 30, '%'),
      visibleWhen: custom,
    },
    {
      ...number(`${end}Camber`, 'Maximum camber', 'm', title, 0, 9, '%'),
      visibleWhen: (p) => p[`${end}Profile`] === 'naca-custom',
    },
    {
      ...number(`${end}CamberPosition`, 'Camber position', 'p/c', title, 10, 90, '%'),
      visibleWhen: (p) => p[`${end}Profile`] === 'naca-custom',
    },
  ];
};
export const parameters: ParameterDefinition[] = [
  select('layout', 'Arrangement', 'Planform', [
    { value: 'single', label: 'Single panel' },
    { value: 'pair', label: 'Mirrored pair' },
  ]),
  select('orientation', 'Orientation', 'Planform', [
    { value: 'horizontal', label: 'Horizontal wing / hydrofoil' },
    { value: 'vertical', label: 'Vertical fin / rudder' },
  ]),
  select('planform', 'Planform', 'Planform', [
    { value: 'trapezoid', label: 'Straight taper / rectangular' },
    { value: 'cranked', label: 'Cranked / double taper' },
    { value: 'elliptic', label: 'Elliptic taper with finite tip' },
  ]),
  {
    ...number('semiSpan', 'Panel span', 's', 'Planform', 5, 10000),
    description: 'Span of one panel, excluding the centre gap. A pair has two panels.',
  },
  number('rootChord', 'Root chord', 'cr', 'Planform', 5, 5000),
  {
    ...number('tipChord', 'Tip chord', 'ct', 'Planform', 1, 5000),
    description:
      'Use a small positive chord for a truncated delta tip; zero-area tips are not supported.',
  },
  {
    ...number('rootGap', 'Centre gap', 'g', 'Planform', 0, 5000),
    visibleWhen: (p) => p.layout === 'pair',
  },
  {
    ...number('sweep', 'Quarter-chord sweep', 'Λ', 'Planform', -70, 70, '°'),
    description:
      'Positive sweep moves the quarter-chord line aft. For cranked panels this controls the inner segment.',
  },
  {
    ...number('kinkPosition', 'Kink span position', 'η', 'Planform', 10, 90, '%'),
    visibleWhen: (p) => p.planform === 'cranked',
  },
  {
    ...number('kinkChord', 'Kink chord', 'ck', 'Planform', 1, 5000),
    visibleWhen: (p) => p.planform === 'cranked',
  },
  {
    ...number('outerSweep', 'Outer quarter-chord sweep', 'Λo', 'Planform', -70, 70, '°'),
    visibleWhen: (p) => p.planform === 'cranked',
  },
  number('dihedral', 'Dihedral / spanwise offset', 'Γ', 'Placement', -60, 60, '°'),
  {
    ...number('incidence', 'Root incidence', 'αr', 'Placement', -45, 45, '°'),
    description:
      'Positive incidence raises the leading edge. Rotation is about each local quarter chord.',
  },
  {
    ...number('twist', 'Tip twist relative to root', 'ε', 'Placement', -30, 30, '°'),
    description: 'Interpolated from root to tip; negative twist lowers tip incidence.',
  },
  ...profileFields('root'),
  ...profileFields('tip'),
  {
    ...number(
      'wedgePosition',
      'Wedge maximum-thickness position',
      'xt/c',
      'Edge details',
      10,
      90,
      '%',
    ),
    visibleWhen: (p) => p.rootProfile === 'diamond' || p.tipProfile === 'diamond',
  },
  {
    ...number('trailingEdge', 'Trailing-edge thickness', 'te', 'Edge details', 0, 20),
    description:
      '0 closes the edge. A positive value modifies the base profile and sets this thickness at every span station.',
  },
  number('spanSegments', 'Span divisions', 'Ns', 'Model quality', 2, 40, '', 1),
  number('profileSegments', 'Chord divisions per side', 'Nc', 'Model quality', 12, 96, '', 1),
  {
    ...number('sectionDepth', 'Profile sample depth', 'b', 'Model quality', 0.5, 50),
    visibleWhen: (_, state) => state === undefined || state !== 'surface',
  },
];
