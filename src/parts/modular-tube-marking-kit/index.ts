import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 680.5,
  dependencies: ['manufactured-detail', 'modular-tube-avionics', 'bolt-screw', 'hex-nut'],
  part: { ...part, id: 'modular-tube-marking-kit' },
} satisfies PartModule;
