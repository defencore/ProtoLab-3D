import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'printed-pin-joint' };

export default {
  apiVersion: 2,
  order: 214,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
