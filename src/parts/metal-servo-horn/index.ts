import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'metal-servo-horn' };
export default {
  apiVersion: 2,
  order: 70.2,
  dependencies: ['underwater-thruster'],
  part,
} satisfies PartModule;
