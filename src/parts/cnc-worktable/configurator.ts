import type { ParameterDefinition, Parameters } from '../../core/types';
import { numberParameter } from '../../core/geometry';

export const defaults: Parameters = {
  component: 'slat',
  length: 1800,
  width: 100,
  thickness: 25,
  slotSpacing: 50,
  slotOpening: 8.5,
  slotWidth: 14,
  slotHeight: 8,
  slotDepth: 14,
  mountPitch: 300,
  supportSpacing: 700,
  bendRadius: 2,
  mountBoltDiameter: 6,
  edgeMount: 15,
  drainDiameter: 25,
  threadFitAllowance: 0,
  ribPassages: '[]',
};
const slotComponent = (p: Parameters) => ['slat', 't-track'].includes(String(p.component));
export const parameters: ParameterDefinition[] = [
  {
    key: 'component',
    label: 'Detail to manufacture',
    type: 'select',
    group: 'Component',
    options: [
      { value: 'slat', label: 'Aluminium T-slot slat' },
      { value: 't-track', label: 'Separate aluminium T-track' },
      { value: 'spoilboard', label: 'PVC-faced chipboard surface' },
      { value: 'hybrid-board', label: 'Chipboard surface with T-track recesses' },
      { value: 'vacuum-plate', label: 'Machined vacuum plate' },
      { value: 'pan-floor', label: 'Coolant tray floor' },
      { value: 'pan-side', label: 'Coolant tray side wall' },
      { value: 'pan-end', label: 'Coolant tray end wall' },
      { value: 'filter-basket', label: 'Perforated chip filter plate' },
      { value: 'tank-body', label: 'Coolant tank body' },
      { value: 'tank-lid', label: 'Coolant tank lid' },
    ],
  },
  numberParameter('length', 'Length', 'L', 'Blank', 50, 4000),
  numberParameter('width', 'Width / wall height', 'W', 'Blank', 20, 3000),
  numberParameter('thickness', 'Thickness', 'T', 'Blank', 1, 60),
  ...[
    ['slotSpacing', 'Slot center spacing', 'P', 10, 1000],
    ['slotOpening', 'T-slot opening', 'a', 3, 20],
    ['slotWidth', 'T-slot cavity width', 'b', 5, 30],
    ['slotHeight', 'T-slot cavity height', 'h', 2, 15],
    ['slotDepth', 'Slot total depth', 'd', 4, 30],
  ].map(([key, label, symbol, min, max]) => ({
    ...numberParameter(
      String(key),
      String(label),
      String(symbol),
      'Workholding',
      Number(min),
      Number(max),
    ),
    visibleWhen:
      String(key) === 'slotSpacing'
        ? (p: Parameters) => String(p.component) === 'hybrid-board' || slotComponent(p)
        : slotComponent,
  })),
  numberParameter('mountPitch', 'Mounting row pitch', 'p', 'Mounting', 50, 500),
  {
    ...numberParameter(
      'supportSpacing',
      'Coolant floor hanger spacing',
      'S',
      'Mounting',
      100,
      1000,
    ),
    visibleWhen: (p: Parameters) => p.component === 'pan-floor',
  },
  {
    ...numberParameter('bendRadius', 'Sheet inner bend radius', 'r', 'Blank', 1, 6),
    visibleWhen: (p: Parameters) => ['pan-side', 'pan-end'].includes(String(p.component)),
  },
  numberParameter('mountBoltDiameter', 'Mounting thread / bolt', 'M', 'Mounting', 4, 12),
  numberParameter('edgeMount', 'Mounting edge distance', 'e', 'Mounting', 4, 50),
  {
    ...numberParameter('drainDiameter', 'Drain / vacuum port', 'D', 'Fluid interface', 4, 40),
    visibleWhen: (p) => ['pan-floor', 'vacuum-plate', 'tank-lid'].includes(String(p.component)),
  },
  {
    ...numberParameter(
      'threadFitAllowance',
      'Thread inspection radial allowance',
      'c',
      'Inspection',
      0,
      0.1,
    ),
    step: 0.01,
    filterable: false,
    visibleWhen: () => false,
  },
  {
    key: 'ribPassages',
    label: 'Explicit fixed-rib wall passages',
    type: 'text',
    group: 'Fabrication',
    filterable: false,
    visibleWhen: () => false,
  },
];
export const catalogSelection = [{ key: 'component', label: 'Surface or tray detail' }];
