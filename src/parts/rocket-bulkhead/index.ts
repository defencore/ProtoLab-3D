import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 122.4,
  part: { ...part, id: 'rocket-bulkhead' },
} satisfies PartModule;
