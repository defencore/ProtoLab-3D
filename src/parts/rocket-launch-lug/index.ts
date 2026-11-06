import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.4,
  part: { ...part, id: 'rocket-launch-lug' },
} satisfies PartModule;
