import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'tr8-quad-geared-rocker-actuator' };
// Execution catalog metadata.
part.mechanismExecution = {
  outputs: 4,
  construction: 'Formed aluminium panels and PETG covers · Ø76/86',
  description: 'Four removable PETG quarters use local motor and gear pockets, dense regions and overlapped seams to form a compact cylindrical enclosure. The metal end discs match its outside diameter.',
  screws: [{ designation: 'TR8×4(P2)', kind: 'lead-screw', lead: 4, pitch: 2, starts: 2 }],
  motors: [{ model: 'Surpass Hobby KK2845 3100KV', when: { motor: 'surpass-2845-3100kv' } }, { model: 'Surpass Hobby 2838 3200KV', when: { motor: 'surpass-2838-3200kv' } }, { model: 'Surpass Hobby 2838 3500KV', when: { motor: 'surpass-2838-3500kv' } }, { model: 'Surpass Hobby 2838 3700KV', when: { motor: 'surpass-2838-3700kv' } }, { model: 'Surpass Hobby 2838 4400KV', when: { motor: 'surpass-2838-4400kv' } }, { model: 'Surpass Hobby 2838 4700KV', when: { motor: 'surpass-2838-4700kv' } }, { model: 'Surpass Hobby 2838 5100KV', when: { motor: 'surpass-2838-5100kv' } }, { model: 'Surpass Hobby 2838 5700KV', when: { motor: 'surpass-2838-5700kv' } }],
  bearings: [{"model": "SMB MF106 2Z"}, {"model": "EZO MR52ZZ"}],
  materials: ['Steel', 'Bronze', 'Aluminium', 'PETG'],
  processes: ['Laser cutting', 'Sheet bending', 'CNC milling', 'Turning', 'Drilling', '3D printing'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {
  apiVersion: 2,
  order: 68.29,
  dependencies: [
    'tr8-geared-rocker-actuator',
    'manufactured-detail',
    'surpass-2845',
    'surpass-2838',
    'flanged-ball-bearing',
    'ball-bearing',
    'bolt-screw',
    'hex-nut',
    'spring-pin',
    'e-ring',
  ],
  part,
} satisfies PartModule;
