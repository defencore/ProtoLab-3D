import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'recovery-buzzer' };
export default {
  apiVersion: 1,
  order: 99.2,
  dependencies: ['flight-controller'],
  part,
} satisfies PartModule;
