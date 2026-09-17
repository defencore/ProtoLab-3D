import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 1,
  order: 121.5,
  part: { ...part, id: 'rocket-airbrakes' },
} satisfies PartModule;
