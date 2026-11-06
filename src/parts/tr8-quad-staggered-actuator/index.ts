import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tr8-quad-staggered-actuator' };
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4,
  construction: 'Staggered CNC frame Ø56',
  description: 'Adjacent nut carriers and outputs alternate between two axial planes, using longer 68 mm screws.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "F695-2RS"}, {"model": "EZO SMF106ZZ"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling', 'Reaming'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default { apiVersion:2, order:68.20, dependencies:['tr8-quad-cnc-actuator'], part } satisfies PartModule;
