import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  dependencies: ['manufactured-detail', 'purchased-component', 'formed-wire'],
  order: 121.7,
  part: { ...part, id: 'clamp-band-release' },
} satisfies PartModule;
