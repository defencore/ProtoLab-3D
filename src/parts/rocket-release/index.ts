import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 121.6,
  dependencies: ['recovery-detail', 'purchased-recovery-component', 'bus-servo', 'bus-servo-driver'],
  part: { ...part, id: 'rocket-release' },
} satisfies PartModule;
