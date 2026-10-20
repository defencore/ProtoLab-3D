import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 70.2,
  part: { ...part, id: 'servo-gear' },
} satisfies PartModule;
