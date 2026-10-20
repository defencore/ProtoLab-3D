import definition from './part';
import type { PartModule } from '../../core/part-modules';
const part = { ...definition, id: 'purchased-component' };
export default {
  apiVersion: 2,
  order: 19.6,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
