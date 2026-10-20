import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  dependencies: ['manufactured-detail', 'purchased-component'],
  order: 121.5,
  part: { ...part, id: 'rocket-airbrakes' },
} satisfies PartModule;
