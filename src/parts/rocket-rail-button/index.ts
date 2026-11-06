import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 122.6,
  dependencies: ['manufactured-detail'],
  part: { ...part, id: 'rocket-rail-button' },
} satisfies PartModule;
