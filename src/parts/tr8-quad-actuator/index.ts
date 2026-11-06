import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-actuator'};
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4,
  construction: 'Three-disc laser frame Ø82',
  description: 'Four radial H-flange drives share three Ø82 discs and independently controlled outward outputs.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F695-2RS"}, {"model": "F686-2RS"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling', 'Reaming'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {
  apiVersion:2,order:68.17,
  dependencies:['tr8-compact-actuator','gmp16-gearmotor','flanged-ball-bearing','jaw-coupling','retaining-ring','bolt-screw','hex-nut','washer','manufactured-detail','pcb-standoff','dowel-pin'],
  part,
} satisfies PartModule;
