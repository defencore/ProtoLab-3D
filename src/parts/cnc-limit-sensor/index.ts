import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-limit-sensor' };
export default {
  apiVersion: 2,
  order: 1317.6,
  dependencies: ['machine-measurement'],
  part,
} satisfies PartModule;
