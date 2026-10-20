import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-guide-rail', catalogSelection };
export default {
  apiVersion: 2,
  order: 64.1,
  part,
} satisfies PartModule;
