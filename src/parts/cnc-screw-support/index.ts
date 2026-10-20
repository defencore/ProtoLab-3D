import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-screw-support', catalogSelection };
export default {
  apiVersion: 2,
  order: 64.3,
  part,
} satisfies PartModule;
