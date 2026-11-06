import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 124.5,
  part: { ...part, id: 'm2-ssd' },
} satisfies PartModule;
