import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'underwater-pressure-enclosure' };
export default {
  apiVersion: 2,
  order: 126.25,
  dependencies: ['underwater-thruster'],
  part,
} satisfies PartModule;
