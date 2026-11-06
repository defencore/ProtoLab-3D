import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 122.2,
  part: { ...part, id: 'rocket-coupler' },
} satisfies PartModule;
