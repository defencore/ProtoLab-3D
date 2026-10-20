import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'gps-tracker' };
export default {
  apiVersion: 2,
  order: 99.1,
  dependencies: ['flight-controller'],
  part,
} satisfies PartModule;
