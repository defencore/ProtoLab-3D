import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-guide-carriage', catalogSelection };
export default {
  apiVersion: 2,
  order: 64.2,
  part,
} satisfies PartModule;
