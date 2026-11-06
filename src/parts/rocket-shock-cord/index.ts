import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.7,
  part: { ...part, id: 'rocket-shock-cord' },
} satisfies PartModule;
