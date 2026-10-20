import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'tube-drill-jig', catalogSelection };
export default {
  apiVersion: 2,
  order: 680,
  dependencies: ['manufactured-detail', 'purchased-component'],
  part,
} satisfies PartModule;
