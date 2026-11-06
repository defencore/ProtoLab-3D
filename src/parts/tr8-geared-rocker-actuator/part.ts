import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { componentDimensions, componentGeometry } from '../../core/assembly/detail-instances';
import { defaults, parameters, motorModels } from './configurator';
import { pieces, libraries } from './lib/model';
import { layout } from './lib/layout';
import { nativePython } from './lib/native';
import { fabricationFiles } from './lib/fabrication';
import product from './product.json';
import presets from './presets.json';
export { pieces, libraries } from './lib/model';
export { layout, fixed, thread } from './lib/layout';
export {
  shaftShape,
  forkShape,
  nutShape,
  screwShape,
  gearOutline,
  forkPlateOutline,
  forkBlankShape,
  outputHoleCenters,
} from './lib/shapes';
export { fabricationFiles } from './lib/fabrication';

const part: PartDefinition = {
  id: 'tr8-geared-rocker-actuator',
  name: 'TR8×4(P2) rotary actuator · Surpass Hobby 2838/2845 · 1 output · 1:1 gears and laser fork · ±20°',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'MOTOR ASSEMBLIES',
  icon: 'gear',
  product: product as ProductProfile,
  browseFamily: { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' },
  description:
    'Parallel Surpass Hobby 2845 or 2838 BLDC and bearing-to-bearing TR8x4 screw with 1:1 hub-pinned gears. A wider twin-pin bronze nut meets the carrier walls at ±20°, driving two laser-cut fork plates and a round output shaft. Four SMB MF106 2Z bearings and an ST3215-pattern output head.',
  preview: 'worker',
  complexity: 'Machined assembly · ±20° output',
  keywords: [
    'TR8x4',
    'P2',
    'Hobby',
    'Surpass',
    '2845',
    '2838',
    '3100KV',
    'MF106',
    'SMB',
    '1:1',
    'gear',
    'twin pin',
    'fork',
    'round shaft',
    'laser plates',
    'ST3215',
    'rocker',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  identityParameters: (p) => ({ ...defaults, motor: p.motor ?? defaults.motor }),
  states: [
    { id: 'assembled', label: 'Assembled', description: 'Complete compact mechanism.' },
    {
      id: 'drive',
      label: 'Drive inspection',
      description: 'Motor, 1:1 gears, lead screw and axial retention.',
    },
    {
      id: 'output',
      label: 'Fork and output',
      description:
        'Twin-pin nut, two laser plates, spring cross-pins and a round shaft in two MF106 bearings.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (
      typeof p.outputAngle !== 'number' ||
      !Number.isFinite(p.outputAngle) ||
      Math.abs(p.outputAngle) > 20
    )
      errors.push('Output angle must be between -20 and +20 degrees.');
    if (!['assembled', 'drive', 'output'].includes(state))
      errors.push('Choose an available inspection state.');
    if (Object.keys(p).some((k) => !['outputAngle', 'motor'].includes(k)))
      errors.push('Choose a supported motor and output angle.');
    if (!motorModels.some((choice) => choice.value === p.motor))
      errors.push('Choose a listed Surpass Hobby motor.');
    return errors;
  },
  composition: (p) => ({
    components: pieces({ ...p, outputAngle: 0 }).map((x) => x.component),
    issues: [],
  }),
  buildGeometry: (p, state) => componentGeometry(libraries, pieces(p, state)),
  dimensions: (p, state) => componentDimensions(libraries, pieces(p, state)),
  python: (p, state) => nativePython(pieces(p, state), layout(p).nutX),
  fabricationFiles,
  notes:
    'The 31 mm TR8x4(P2) working thread spans the bearing-to-bearing space. A 16 mm long nut travels 15 mm between the carrier walls; its stops correspond to ±20° through a 20.606 mm lever. End-face relief keeps stop loads off bearing faces. Both gears have separate Ø12 outboard hubs, cross-pinned outside the tooth faces: Ø2×10 on the screw and Ø1×10 on the motor shaft. The motor needs a secondary Ø1 cross-drill 13 mm from its mounting face. Select 2845 3100KV or one of seven 2838 KV variants. Three DIN 6799-3.2 E-Clips on short Ø5 necks sit directly at the Ø6 bearing edges without shims. The preview uses a reduced mesh while native CAD retains the analytic tooth profiles. The motor mounts directly to the flat plate using two M3×5 low-head screws. Two identical 3 mm laser plates are pinned to the round Ø6 output shaft. The four custom M3 output-head holes follow ST3215 PCD14 locations. Qualify fits, pin-joint capacity, mechanical stop loads, control and cable routing for the application.',
  sources: [
    {
      label: 'SMB MF106ZZ manufacturer drawing',
      url: 'https://www.smbbearings.com/firebrick/ckeditor/plugins/upload/Uploads/Documents/bearingpdfs/MF106ZZ-flanged-miniature-bearing-6x10x3mm.pdf',
    },
    {
      label: 'TR8x4(2P) lead screw specification',
      url: 'https://ooznest.co.uk/product/tr8x4-2p-lead-screw-cut-to-size/',
    },
    {
      label: 'Surpass Hobby branded 2845 drawing',
      url: 'https://images-na.ssl-images-amazon.com/images/I/51uWegAEAqL.jpg',
    },
    {
      label: 'Waveshare ST3215 output-disc CAD and drawings',
      url: 'https://docs.waveshare.com/ST3215_Servo/Resources-And-Documents',
    },
  ],
};
export default part;
