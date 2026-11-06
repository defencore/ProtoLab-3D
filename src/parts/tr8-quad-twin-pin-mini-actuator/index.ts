import type {PartModule} from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-twin-pin-mini-actuator'};
// Execution catalog metadata.
part.browseFamily = { id: 'screw-rotary-actuators', label: 'Screw-driven rotary mechanisms' };
part.mechanismExecution = {
  outputs: 4,
  construction: 'Mini twin-pin laser frame Ø54',
  description: 'Shorter output bearing stacks and relocated supports fit Ø54 discs with selectable lightening.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'GMP16T-TEC1636' }],
  bearings: [{"model": "SMB MF105 2Z", "when": {"bearingKit": "prom-smb"}}, {"model": "SMB MF106 2Z", "when": {"bearingKit": "prom-smb"}}, {"model": "SMB MF63 2Z", "when": {"bearingKit": "prom-smb"}}, {"model": "F695-2RS", "when": {"bearingKit": "reference"}}, {"model": "EZO SMF106ZZ", "when": {"bearingKit": "reference"}}, {"model": "EZO SMF63ZZ", "when": {"bearingKit": "reference"}}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling', 'Reaming'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {apiVersion:2,order:68.25,dependencies:['tr8-quad-twin-pin-actuator','tr8-quad-laser-guided-actuator','tr8-quad-cnc-actuator','tr8-compact-actuator'],part} satisfies PartModule;
