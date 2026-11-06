import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.2,
  part: { ...part, id: 'rocket-transition' },
} satisfies PartModule;
