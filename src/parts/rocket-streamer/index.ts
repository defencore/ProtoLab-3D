import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 123.6,
  part: { ...part, id: 'rocket-streamer' },
} satisfies PartModule;
