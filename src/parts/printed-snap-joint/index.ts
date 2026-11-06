import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'printed-snap-joint' };

export default {
  apiVersion: 2,
  order: 314,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
