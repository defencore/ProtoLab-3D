import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { motorPieces } from './lib/model';
import { geometry, python, dimensions } from './lib/assembly';
const part: PartDefinition = {
  id: 'machine-drive-motor',
  name: 'Machine drive motor',
  category: 'MACHINE TOOLS',
  subgroup: 'DRIVES & CONTROLS',
  description:
    'Purchased spindle and feed motors with supplier dimensions and nominal mounting interfaces.',
  keywords: ['BEVI', '230', 'stepper', 'encoder', 'spindle', 'motor'],
  icon: 'wheel',
  complexity: 'Purchased motor',
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'shaftDiameter',
      label: 'Shaft diameter',
      type: 'number',
      unit: 'mm',
      min: 0,
      max: 500,
      step: 0.01,
      group: 'Dimensions',
      catalogSummary: true,
    },
  ],
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  validate: (p) =>
    presets.some((v) => v.parameters.model === p.model) ? [] : ['Select a catalog motor.'],
  buildGeometry: (p) => geometry(motorPieces(p)),
  dimensions: (p) => dimensions(motorPieces(p)),
  python: (p) =>
    python(motorPieces(p)) +
    `
component_manufactured = [False]*${motorPieces(p).length}
component_groups = [["Purchased motor"]]*${motorPieces(p).length}
component_metadata = [{"Procurement":"BUY_ASSEMBLY","GeometryEvidence":"Source-based external dimensions; housing cosmetics simplified. Verify stepper pilot and hole pattern before machining."}]*${motorPieces(p).length}`,
  assessment: (p) =>
    p.model === 'bevi90l2'
      ? [
          'BEVI 121116: 2.2 kW, 2890 rpm at 50 Hz, 230/400 V, 7.7 A at 230 V. Use the 230 V delta connection with a compatible VFD.',
          'B3 foot interface A140 B125 C56 H90 K10; shaft D24 E50, key8, total L375.',
        ]
      : [
          '57x57x80 mm body, D6.35x21 mm shaft, 1.85 Nm holding torque, 2.8 A/phase, 1000 PPR encoder. Holding torque is not available running torque.',
        ],
  notes:
    'Stepper bearing rings and rotor geometry are representative; winding detail is omitted. Output bearings of the saw spindle are separate from the motor. Confirm torque-speed capability at the actual drive voltage.',
  sources: presets.map((p) => ({ label: p.name, url: p.catalog.sourceUrl })),
};
export default part;
