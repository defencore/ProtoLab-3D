import type {PartModule} from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-laser-guided-actuator'};
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4,
  construction: 'Laser frame Ø64 with separate central guide',
  description: 'Demountable laser-cut discs and cheeks use a separate milled guide and selectable crank construction.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F695-2RS"}, {"model": "EZO SMF106ZZ"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling', 'Reaming'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {apiVersion:2,order:68.23,dependencies:['tr8-quad-cnc-actuator','tr8-compact-actuator','pcb-standoff'],part} satisfies PartModule;
