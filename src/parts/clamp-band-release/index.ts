import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 1,
  order: 121.7,
  part: { ...part, id: 'clamp-band-release' },
} satisfies PartModule;
