import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.1,
  part: { ...part, id: 'rocket-nose-cone' },
} satisfies PartModule;
