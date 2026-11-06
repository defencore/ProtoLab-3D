import type {PartModule} from '../../core/part-modules';
import definition from './part';
const part={...definition,id:'tr8-quad-surpass-actuator'};
part.browseFamily={id:'screw-rotary-actuators',label:'Screw-driven rotary mechanisms'};
part.mechanismExecution = {
  outputs: 4,
  construction: 'Surpass2845 3100KV · laser Ø70',
  description: 'Four Ø28 inrunners with selectable single-start TR8x2 or four-start TR8x8 screws and matching twin-pin nuts.',
  screws: [
    { designation: 'TR8×2(P2)', kind: 'lead-screw', lead: 2, pitch: 2, starts: 1, when: { screwModel: 'tr8x2-p2' } },
    { designation: 'TR8×8(P2)', kind: 'lead-screw', lead: 8, pitch: 2, starts: 4, when: { screwModel: 'tr8x8-p2' } },
  ],
  motors: [{ model: 'Surpass Hobby KK2845 3100KV' }],
  bearings: [{"model": "SMB MF105 2Z"}, {"model": "SMB MF106 2Z"}, {"model": "SMB MF63 2Z"}],
  materials: ['Steel', 'Brass', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
export default {apiVersion:2,order:68.27,dependencies:['tr8-quad-twin-pin-mini-actuator','tr8-quad-twin-pin-actuator','tr8-quad-cnc-actuator','tr8-compact-actuator','tr8-quad-laser-guided-actuator','surpass-2845'],part} satisfies PartModule;
