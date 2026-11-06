import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 124.3,
  part: { ...part, id: 'optical-dome-window' },
} satisfies PartModule;
