import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'sfk-rotary-actuator' };
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 1,
  construction: 'Machined supports and closed forks',
  description: 'Machined bearing supports and closed forks capture the clocked nut cover against rotation.',
  screws: [{ designation: 'SFK0825', kind: 'ball-screw', lead: 2.5 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F686-2RS"}],
  materials: ['Steel', 'Aluminium', 'Bronze'],
  processes: ['CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
// End execution catalog metadata.

export default {
  apiVersion: 2,
  order: 68.1,
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
  ],
  part,
} satisfies PartModule;
