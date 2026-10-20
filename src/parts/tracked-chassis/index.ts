import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'tracked-chassis' };
export default {
  apiVersion: 2,
  dependencies: ['manufactured-detail', 'formed-wire', 'machine-drive-motor', 'ball-bearing'],
  order: 1260,
  part,
} satisfies PartModule;
