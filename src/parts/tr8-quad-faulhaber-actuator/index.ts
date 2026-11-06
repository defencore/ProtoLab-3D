import type {PartModule} from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-faulhaber-actuator'};
part.browseFamily={id:'screw-rotary-actuators',label:'Screw-driven rotary mechanisms'};
part.mechanismExecution = {
  outputs: 4,
  construction: 'FAULHABER direct drive · laser Ø56',
  description: 'Four 2250S024BX4 6855 motors with supplier CAD and compact twin-pin linkages.',
  screws: [{ designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4 }],
  motors: [{ model: 'FAULHABER 2250S024BX4 6855' }],
  bearings: [{"model": "SMB MF105 2Z"}, {"model": "SMB MF106 2Z"}, {"model": "SMB MF63 2Z"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
// The configured 2250S024BX4-6855 source motor has a documented 24 V nominal supply.
part.discovery = [{ kind: 'power', key: 'supplyVoltage', label: 'Motor nominal voltage', value: 24, unit: 'V' }];
export default {apiVersion:2,order:68.26,dependencies:['tr8-quad-twin-pin-mini-actuator','tr8-quad-twin-pin-actuator','tr8-quad-cnc-actuator','tr8-compact-actuator','tr8-quad-laser-guided-actuator','faulhaber-bx4','bolt-screw'],part} satisfies PartModule;
