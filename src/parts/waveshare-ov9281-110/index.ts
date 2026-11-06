import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 124.45,
  part: { ...part, id: 'waveshare-ov9281-110' },
} satisfies PartModule;
