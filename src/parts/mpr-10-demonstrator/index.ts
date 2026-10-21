import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'mpr-10-demonstrator' };

export default {
  apiVersion: 2,
  order: 1060,
  dependencies: [
    'manufactured-detail',
    'stepper-motor',
    'ball-screw',
    'ball-nut',
    'ball-bearing',
    'bolt-screw',
    'hex-nut',
    'e-ring',
    'pcb-standoff',
    'threaded-rod',
  ],
  part,
} satisfies PartModule;
