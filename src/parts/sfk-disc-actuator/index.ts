import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'sfk-disc-actuator' };
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 1,
  construction: 'Three-disc laser frame Ø68',
  description: 'Three 4 mm steel discs, metal standoffs and tabbed bearing cheeks support one closed-fork output.',
  screws: [{ designation: 'SFK0825', kind: 'ball-screw', lead: 2.5 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F686-2RS"}],
  materials: ['Steel', 'Aluminium', 'Bronze', 'Brass'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
// End execution catalog metadata.

export default {
  apiVersion: 2,
  order: 68.15,
  dependencies: [
    'gmp16-gearmotor',
    'ball-screw',
    'flanged-ball-bearing',
    'jaw-coupling',
    'retaining-ring',
    'bolt-screw',
    'hex-nut',
    'washer',
    'manufactured-detail',
    'pcb-standoff',
  ],
  part,
} satisfies PartModule;
