import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 1,
  order: 121.6,
  part: { ...part, id: 'rocket-release' },
} satisfies PartModule;
