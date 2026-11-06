import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 122.1,
  part: { ...part, id: 'rocket-body-tube' },
} satisfies PartModule;
