import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/boundary/assembly';
import { withGeometryMode } from '../../core/geometry-mode';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { spindleSpec, spindleSpecs } from './lib/specs';
import { spindlePieces, spindlePython, spindleDimensions } from './lib/model';
export { spindleSpec, spindleSpecs } from './lib/specs';
export type { SpindleSpec } from './lib/specs';
export { defaults as spindleDefaults } from './configurator';
const part: PartDefinition = {
  id: 'cnc-spindle',
  product: profile as ProductProfile,
  name: 'Spindle motor / manufacturer drawing execution',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SPINDLE MOTORS',
  icon: 'gear',
  description:
    'Five water- and air-cooled purchased spindle executions with source-dimensional bodies and explicit installation interfaces.',
  complexity: 'Purchased installation model',
  keywords: ['CNC', 'spindle', 'ER11', 'ER20', 'JST', 'Huajiang', 'water', 'air'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogFilterFields,
  presetMatchKeys: ['model'],
  validate(p) {
    try {
      spindleSpec(p);
      return [];
    } catch (e) {
      return [e instanceof Error ? e.message : String(e)];
    }
  },
  buildGeometry: (p) => assembly.geometry(spindlePieces(p)),
  python: spindlePython,
  dimensions: spindleDimensions,
  buildExportGeometry: (p) => withGeometryMode('simple', () => assembly.geometry(spindlePieces(p))),
  notes:
    'One complete purchased unit. These manufacturer drawing executions are not confirmed factory-installed machine parts. Source dimensions control the main body, axial shoulders and declared tool interfaces; undimensioned nuts, port positions, connectors, vents and shell split lines are qualified inspection envelopes. No hidden rotor, bearings or winding is invented. Simple omits helical flanks while retaining source/callout notes; Full models authored JST shaft/nut profiles and the explicitly qualified standard-derived ER20 interface for ZHJ. The ZHJ source does not declare shaft pitch: measure that interface before procurement or release. Verify exact execution, mounting permission, VFD and cooling before release.',
  sources: spindleSpecs.map((s) => ({
    label: s.name + ' / manufacturer source',
    url: s.sourceUrl,
  })),
};
export default part;
