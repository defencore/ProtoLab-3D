import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-precision-axis', catalogSelection };
export default {
  apiVersion: 2,
  order: 64.75,
  part,
  dependencies: ['cnc-precision-screw', 'cnc-precision-nut'],
} satisfies PartModule;
