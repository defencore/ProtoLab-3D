import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 124.2,
  part: { ...part, id: 'waveshare-pcie-m2-d' },
} satisfies PartModule;
