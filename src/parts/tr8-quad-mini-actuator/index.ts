import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-mini-actuator'};
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4,
  construction: 'Mini three-disc laser frame Ø72',
  description: 'Smaller SMF106ZZ output bearings and narrower pinned linkages reduce the frame to Ø72.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F695-2RS"}, {"model": "EZO SMF106ZZ"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling', 'Reaming'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {
  apiVersion:2,order:68.18,
  dependencies:['tr8-compact-actuator','gmp16-gearmotor','flanged-ball-bearing','jaw-coupling','retaining-ring','bolt-screw','hex-nut','washer','manufactured-detail','pcb-standoff','dowel-pin'],
  part,
} satisfies PartModule;
