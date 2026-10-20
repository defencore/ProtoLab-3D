import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 121.4,
  dependencies: ['rocket-release', 'rocket-airbrakes', 'manufactured-detail', 'purchased-component'],
  part: { ...part, id: 'rocket-parachute-recovery' },
} satisfies PartModule;
