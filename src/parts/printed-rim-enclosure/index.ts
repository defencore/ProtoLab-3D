import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'printed-rim-enclosure' };
export default {
  apiVersion: 2,
  order: 401,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
