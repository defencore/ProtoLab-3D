import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-frame-part' };
export default {
  apiVersion: 2,
  order: 1320,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
