import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tr8-geared-rocker-actuator' };
// Execution catalog metadata.
part.mechanismExecution = {
  outputs: 1,
  construction: '1:1 geared drive · laser fork · MF106 bearings',
  description: 'Two laser-cut fork plates pinned to a turned round shaft, with two screw bearings seated directly in the one-piece carrier.',
  screws: [{ designation: 'TR8×4(P2)', kind: 'lead-screw', lead: 4, pitch: 2, starts: 2 }],
  motors: [{ model: 'Surpass Hobby KK2845 3100KV', when: { motor: 'surpass-2845-3100kv' } }, { model: 'Surpass Hobby 2838 3200KV', when: { motor: 'surpass-2838-3200kv' } }, { model: 'Surpass Hobby 2838 3500KV', when: { motor: 'surpass-2838-3500kv' } }, { model: 'Surpass Hobby 2838 3700KV', when: { motor: 'surpass-2838-3700kv' } }, { model: 'Surpass Hobby 2838 4400KV', when: { motor: 'surpass-2838-4400kv' } }, { model: 'Surpass Hobby 2838 4700KV', when: { motor: 'surpass-2838-4700kv' } }, { model: 'Surpass Hobby 2838 5100KV', when: { motor: 'surpass-2838-5100kv' } }, { model: 'Surpass Hobby 2838 5700KV', when: { motor: 'surpass-2838-5700kv' } }],
  bearings: [{"model": "SMB MF106 2Z"}],
  materials: ['Steel', 'Bronze', 'Aluminium'],
  processes: ['Laser cutting', 'CNC milling', 'Turning', 'Drilling'],
  travelDegrees: 20,
};
// End execution catalog metadata.
export default {
  apiVersion: 2,
  order: 68.28,
  dependencies: [
    'surpass-2845',
    'surpass-2838',
    'flanged-ball-bearing',
    'bolt-screw',
    'manufactured-detail',
    'spring-pin',
    'e-ring',
  ],
  part,
} satisfies PartModule;
