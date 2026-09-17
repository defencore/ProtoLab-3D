import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import { layout } from './lib/motion';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'rocket-release',
  name: 'Rocket Release Mechanism',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  complexity: '2 drive layouts · 8 retaining points',
  description:
    'Eight-point rotating release ring with four gearmotors or one central servo and four idlers. Spring-assisted tube separation; Ø80/76 default.',
  keywords: [
    'release mechanism',
    'separation',
    'bayonet',
    'keyhole',
    'spring',
    'rocket',
    'servo',
    'sun gear',
    '80/76',
    'відділення',
    'замок',
    'розділення',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Both tube sections and the release mechanism.',
    },
    {
      id: 'cutaway',
      label: 'Housing cutaway',
      description: 'Quarter of the housing removed to inspect drive and locks.',
    },
    {
      id: 'open',
      label: 'Tubes removed',
      description: 'Carrier, drive, eight studs, rotating disk and four spring pushers.',
    },
    {
      id: 'mechanism',
      label: 'Mechanism only',
      description: 'The operating components with tubes and carrier hidden.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'cutaway', 'open', 'mechanism'].includes(state))
      errors.push('Select a valid assembly view.');
    if (!['four-motors', 'central-servo'].includes(String(p.drive)))
      errors.push('Select a drive layout.');
    if (p.drive === 'four-motors' && !['12', '16'].includes(String(p.motor)))
      errors.push('Select a motor installation envelope.');
    if (+p.tubeOD - +p.tubeID < 1 || +p.tubeOD - +p.tubeID > 12)
      errors.push('Tube wall must be between 0.5 and 6 mm.');
    const m = layout(p);
    if (m.pitchRadius + m.module * 1.25 + 0.8 > m.lockRadius - 3.05)
      errors.push('Insufficient material between the gear root and retaining slots.');
    if (!m.centralServo && m.driveRadius + m.motorRadius > m.lockRadius - 4.2)
      errors.push('Gearmotor body would intersect the spring-seat support.');
    if (m.centralServo && 2 * (m.pinionRadius + m.module) >= Math.SQRT2 * m.driveRadius)
      errors.push('Adjacent idler tip circles need clearance.');
    if (+p.separation < +p.springTravel + 4)
      errors.push('Show at least 4 mm separation beyond the spring travel.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Parametric reconstruction from the supplied photographs and diagram, not source CAD. Four-motor layout: four 20-tooth pinions drive an 80-tooth internal ring. Single-servo layout: one central 20-tooth pinion drives four 40-tooth idlers on fixed axes and a 100-tooth ring. The ring turns opposite to the servo at 1/5 of its angle: 14° ring travel requires 70° servo travel. The 9° initial sun-gear phase aligns all four meshes. The servo uses the nominal MG90S 22.8 × 12.2 × 28.5 mm body envelope; ears, mounting spacers and D-shaft adaptor are reconstructed. Eight stationary headed studs hold curved keyhole slots. At 60% of the sequence the large holes align with all stud heads; only then does the upper disk and attached tube move axially. Four captive spring pushers remain on the lower carrier. Further separation is an illustrative position, not predicted flight motion. Spring rate, required torque, motor control, strength and flight qualification are not established. Threads, gear cutter fillets, servo spline and motor internals are simplified.',
  sources: [
    {
      label: 'Tower Pro · MG90S nominal body envelope',
      url: 'https://towerpro.com.tw/product/mg90s-3/',
    },
  ],
};
export default part;
