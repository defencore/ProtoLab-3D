import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'ms5837-depth-sensor' };
export default {
  apiVersion: 2,
  order: 124.7,
  dependencies: ['underwater-thruster'],
  part,
} satisfies PartModule;
