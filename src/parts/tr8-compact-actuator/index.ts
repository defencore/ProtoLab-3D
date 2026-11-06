import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tr8-compact-actuator' };
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms', primary: true };
part.mechanismExecution = {
  outputs: 1,
  construction: 'Compact three-disc laser frame Ø56',
  description: 'One H-flange nut and closed-fork output use a 50 mm screw and three Ø56 steel discs.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F695-2RS"}, {"model": "F686-2RS"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {
  apiVersion: 2,
  order: 68.16,
  dependencies: [
    'gmp16-gearmotor',
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
