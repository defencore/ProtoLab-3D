import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'printed-screw-enclosure' };
export default {
  apiVersion: 2,
  order: 734,
  dependencies: ['manufactured-detail', 'bolt-screw', 'hex-nut'],
  part,
} satisfies PartModule;
