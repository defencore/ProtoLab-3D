import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'boat-hull-frame' };
export default {
  apiVersion: 2,
  order: 122.5,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
