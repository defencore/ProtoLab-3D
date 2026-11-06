import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'printed-bayonet-enclosure' };
export default {
  apiVersion: 2,
  order: 74,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
