import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'pwm-switch' };
export default {
  apiVersion: 2,
  order: 110.1,
  dependencies: ['flight-controller'],
  part,
} satisfies PartModule;
