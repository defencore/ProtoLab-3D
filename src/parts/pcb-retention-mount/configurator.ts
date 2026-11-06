import type { Parameters, ParameterDefinition } from '../../core/types';

export const defaults: Parameters = {
  boardCount: 1,
  board1Length: 80,
  board1Width: 60,
  board2Length: 80,
  board2Width: 60,
  board3Length: 80,
  board3Width: 60,
  board4Length: 80,
  board4Width: 60,
  boardThickness: 1.6,
  seatHeight: 8,
  boardGap: 10,
  baseThickness: 3,
  clearance: 0.25,
  lockEnabled: true,
  antiFlexSupports: 'side',
  supportPitch: 35,
  mountingHoles: true,
  mountingHoleDiameter: 3.4,
  mountingEdgeInset: 6,
  showReferences: true,
};
const number = (
  key: string,
  label: string,
  group: string,
  min: number,
  max: number,
  step: number,
  description?: string,
): ParameterDefinition => ({
  key,
  label,
  group,
  type: 'number',
  unit: 'mm',
  min,
  max,
  step,
  description,
});

export const parameters: ParameterDefinition[] = [
  {
    key: 'boardCount',
    label: 'Number of PCBs',
    group: 'PCB layout',
    type: 'number',
    unit: '',
    min: 1,
    max: 4,
    step: 1,
  },
  ...[1, 2, 3, 4].flatMap((index) => [
    {
      ...number(`board${index}Length`, 'PCB length along X', `PCB ${index}`, 30, 180, 0.5),
      visibleWhen: (p: Parameters) => Number(p.boardCount) >= index,
    },
    {
      ...number(`board${index}Width`, 'PCB width along Y', `PCB ${index}`, 40, 140, 0.5),
      visibleWhen: (p: Parameters) => Number(p.boardCount) >= index,
    },
  ]),
  number(
    'boardThickness',
    'Bare PCB thickness',
    'PCB layout',
    0.8,
    3.2,
    0.1,
    'Measure the bare substrate. Underside solder, leads and component keepouts require inspection before enabling extra supports.',
  ),
  number(
    'boardGap',
    'Gap between adjacent PCB edges',
    'PCB layout',
    10,
    20,
    0.5,
    'Rows are arranged along +X, centered at Y=0. For one locked PCB this also sets the free-side key bay.',
  ),
  number(
    'seatHeight',
    'PCB underside above carrier floor',
    'Seating',
    4,
    35,
    0.5,
    'Z=0 is the carrier underside. With the lock enabled the seating plane must be at least 5 mm above the carrier top.',
  ),
  number('baseThickness', 'Carrier plate thickness', 'Seating', 2, 5, 0.5),
  {
    key: 'lockEnabled',
    label: 'Removable sliding PCB lock',
    group: 'Retention',
    type: 'boolean',
    description:
      'Integral bayonet seats and removable bridge(s), with a 3 mm locking stroke and an accessible release leaf. Without locks all board seats are open for direct vertical removal.',
  },
  number(
    'clearance',
    'PCB side and roof clearance',
    'Retention',
    0.15,
    0.5,
    0.05,
    'Per mating side; a geometric fit allowance, not a printer tolerance. Print and measure a matching coupon.',
  ),
  {
    key: 'antiFlexSupports',
    label: 'Additional anti-flex supports',
    group: 'Anti-flex support',
    type: 'select',
    options: [
      { value: 'none', label: 'No additional rails or ribs' },
      { value: 'side', label: 'Along PCB side edges' },
      { value: 'under', label: 'Ribs beneath the PCB' },
      { value: 'both', label: 'Side edges and underside ribs' },
    ],
    description:
      'Corner seats remain in every configuration; enabled locks also have local underside lands. Side supports need clear 3 mm underside edge strips; underside ribs need their complete selected contact lines free of solder and components.',
  },
  {
    ...number(
      'supportPitch',
      'Maximum underside rib spacing',
      'Anti-flex support',
      15,
      60,
      1,
      'Ribs span the selected board width, with 6 mm side-edge relief. No stiffness or allowable load is assigned.',
    ),
    visibleWhen: (p) => ['under', 'both'].includes(String(p.antiFlexSupports)),
  },
  {
    key: 'mountingHoles',
    label: 'Four carrier mounting holes',
    group: 'Host integration',
    type: 'boolean',
  },
  {
    ...number(
      'mountingHoleDiameter',
      'Mounting through-hole diameter',
      'Host integration',
      2,
      5,
      0.1,
    ),
    visibleWhen: (p) => p.mountingHoles === true,
  },
  {
    ...number(
      'mountingEdgeInset',
      'Hole center inset from carrier edges',
      'Host integration',
      4,
      8,
      0.5,
    ),
    visibleWhen: (p) => p.mountingHoles === true,
  },
  {
    key: 'showReferences',
    label: 'Show PCB installation references',
    group: 'Inspection',
    type: 'boolean',
    filterable: false,
    description:
      'Bare board outlines only; omitted from procurement, manufactured composition, STL and native fabrication geometry.',
  },
];
export const catalogSelection = [];

export function updateParameters(p: Parameters, changedKey: string): Parameters {
  if (p.lockEnabled && ['lockEnabled', 'baseThickness'].includes(changedKey))
    return { ...p, seatHeight: Math.max(Number(p.seatHeight), Number(p.baseThickness) + 5) };
  if (!p.lockEnabled && changedKey === 'baseThickness')
    return { ...p, seatHeight: Math.max(Number(p.seatHeight), Number(p.baseThickness) + 1) };
  return p;
}
