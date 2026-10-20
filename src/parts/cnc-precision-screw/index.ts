import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-precision-screw', catalogSelection };
export default {
  apiVersion: 2,
  order: 64.7,
  part,
  dependencies: ['cnc-precision-nut'],
} satisfies PartModule;
