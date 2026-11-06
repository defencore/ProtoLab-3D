import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.5,
  part: { ...part, id: 'rocket-parachute' },
} satisfies PartModule;
