import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'worm-fin-actuator', browseLabel: 'Worm-sector actuator' };

export default {
  apiVersion: 2,
  order: 68.8,
  dependencies: [
    'tr8-compact-actuator',
    'flanged-ball-bearing',
    'retaining-ring',
    'bolt-screw',
    'hex-nut',
    'manufactured-detail',
  ],
  part,
} satisfies PartModule;
