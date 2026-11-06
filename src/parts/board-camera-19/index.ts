import type { PartModule } from '../../core/part-modules';
import part from './part';

export default {
  apiVersion: 2,
  order: 124.4,
  part: { ...part, id: 'board-camera-19' },
} satisfies PartModule;
