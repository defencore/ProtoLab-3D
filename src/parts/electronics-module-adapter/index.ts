import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'electronics-module-adapter' };
export default {
  apiVersion: 2,
  order: 1410,
  dependencies: ['servo-toggle-actuator'],
  part,
} satisfies PartModule;
