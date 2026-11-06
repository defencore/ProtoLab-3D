import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'printed-self-centering-enclosure' };
export default {
  apiVersion: 2,
  order: 402,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
