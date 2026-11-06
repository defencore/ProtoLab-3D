import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'printed-dovetail-joint', catalogSelection };
export default {
  apiVersion: 2,
  order: 58,
  dependencies: ['manufactured-detail'],
  part,
} satisfies PartModule;
