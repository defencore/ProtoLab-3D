import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 122.3,
  part: { ...part, id: 'rocket-centering-ring' },
} satisfies PartModule;
