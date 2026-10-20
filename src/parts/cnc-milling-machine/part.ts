import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { validateParameters } from '../../core/validation';
import type { ProductProfile } from '../../core/product-types';
import { millingPython } from './lib/native';
import { millingGeometry, millingDimensions } from './lib/render';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { millingQualificationAssessment } from './lib/qualification';
import {
  millingComposition,
  millingLibraries,
  millingPieces,
  millingComponents,
  millingIssues,
} from './lib/composition';
export {
  millingComponents,
  millingComposition,
  millingPieces,
  millingLibraries,
} from './lib/composition';
export { millingLayout } from './lib/layout';
const states = [
  { id: 'assembled', label: 'Assembly' },
  { id: 'exploded', label: 'Inspection separation' },
  { id: 'x-min', label: 'X minimum' },
  { id: 'x-max', label: 'X maximum' },
  { id: 'y-min', label: 'Y minimum' },
  { id: 'y-max', label: 'Y maximum' },
  { id: 'z-min', label: 'Z minimum' },
  { id: 'z-max', label: 'Z maximum' },
  { id: 'z-head', label: 'Z assembly / details' },
  { id: 'mechanism', label: 'Motion mechanism' },
  { id: 'bed', label: 'Fixed bed / worktable' },
].map((s) => ({
  ...s,
  description:
    'Inspect the configured assembly; physical library identities and the canonical BOM remain unchanged.',
}));
const part: PartDefinition = {
  id: 'cnc-milling-machine',
  name: 'ProtoLab CNC / 800x1500x200',
  browseFamily: { id: 'cnc-milling-machines', label: 'CNC milling machines' },
  product: profile as ProductProfile,
  category: 'MACHINE TOOLS',
  subgroup: 'MILLING MACHINES',
  icon: 'gear',
  preview: 'worker',
  complexity: 'Three driven axes / separate library parts',
  description:
    'Fixed table and moving closed gantry with a central under-table Y screw, independently manufactured plates and real configured guides, supports, motors and spindle.',
  keywords: [
    'CNC',
    'mill',
    'milling',
    '800',
    '1500',
    'metal',
    'aluminium',
    'brass',
    'bronze',
    'HGR20',
    'D16T',
    'duralumin',
    'aerospace',
    '0.025',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states,
  validate(p, state) {
    const errors: string[] = [];
    if (!states.some((s) => s.id === state)) errors.push('Select a supported inspection state.');
    for (const d of parameters) {
      const value = p[d.key];
      if (
        d.type === 'number' &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < Number(d.min) ||
          value > Number(d.max))
      )
        errors.push(d.label + ' is outside its finite range.');
      if (d.type === 'select' && !d.options!.some((o) => o.value === value))
        errors.push('Choose a supported ' + d.label.toLowerCase() + '.');
      if (d.type === 'boolean' && typeof value !== 'boolean')
        errors.push(d.label + ' must be enabled or disabled.');
    }
    for (const key of ['xPosition', 'yPosition', 'zPosition'])
      if (![0, 50, 100].includes(Number(p[key])))
        errors.push(
          'Use the assembly midpoint or named axis minimum/maximum inspection states. Apply the default configuration to clear a continuous pose.',
        );
    if (errors.length) return errors;
    for (const item of millingComponents(p)) {
      const definition = millingLibraries.find((d) => d.id === item.component.libraryId)!;
      errors.push(
        ...validateParameters(definition, item.component.parameters, item.component.state).map(
          (e) => item.component.id + ': ' + e,
        ),
      );
    }
    return errors;
  },
  composition: millingComposition,
  buildGeometry: (p, s) => millingGeometry(p, s),
  buildExportGeometry: (p, s) => millingGeometry(p, s, true),
  dimensions: millingDimensions,
  python: millingPython,
  assessment: (p) => [
    ...millingQualificationAssessment(p),
    'Actual travel: X 800 mm, Y 1500 mm, Z 200 mm. The fixed head clears the table by 220 mm.',
    `With the configured ${Number(p.toolProjection)} mm tool projection and 20 mm upward retract, stock height is at most 180 mm before fixture allowance. A 200 mm stock fits the head envelope but leaves no upward cutter retract.`,
    'Finished-part design target: complete 0.05 mm tolerance field (±0.025 mm) for D16T and other nonferrous-metal prototypes. Steel requires a separately qualified light-cut process. This is a target pending calibration and loaded machining tests.',
    'Every installed component retains its library identity. Use inspection separation to examine the assembly and open individual parts for FreeCAD drawings.',
  ],
  notes:
    'Authored DIY arrangement, not a factory replica. Workspace 800×1500×200 is the supplier reference. The selected spindle, retained screw ends, rails/carriages, drives and bolted frames are separately configured library items. Factory envelope 1950×1210×920 and mass are not attributed to this design. Primary targets are D16T/duralumin, other aluminium alloys, brass and bronze prototypes with a complete 0.05 mm finished-part tolerance field (±0.025 mm). Steel is conditional on a separately accepted light-cut process. Tool projection is configurable from 20 to 50 mm, default 25 mm, with its tip spanning tableTop..tableTop+200. A 200 mm stock leaves no upward retract; allow at most 180 mm stock for 20 mm retract before fixture allowance. The selected projection is a clearance envelope until an actual cutter and collet are qualified. Calibration, thermal control and loaded coupon tests must establish finished-part accuracy.',
  sources: [
    {
      label: 'CNC Machines UA / reference work range and equipment options',
      url: 'https://cncmachines.com.ua/uk/product/yastreb-8015-200/',
    },
  ],
};
export default part;
