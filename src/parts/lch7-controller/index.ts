import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'lch7-controller' };
export default {
  apiVersion: 1,
  order: 97.1,
  dependencies: ['flight-controller'],
  part,
} satisfies PartModule;
