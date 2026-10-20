import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'tube-arm-clamp', catalogSelection };
export default {
  apiVersion: 2,
  order: 129,
  dependencies: ['manufactured-detail', 'bolt-screw', 'hex-nut', 'washer'],
  part,
} satisfies PartModule;
