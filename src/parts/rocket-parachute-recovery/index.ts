import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 1,
  order: 121.4,
  dependencies: ['rocket-release', 'rocket-airbrakes'],
  part: { ...part, id: 'rocket-parachute-recovery' },
} satisfies PartModule;
