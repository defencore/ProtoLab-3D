import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'ball-screw-axis', catalogSelection };
export default {
  apiVersion: 2,
  order: 68,
  dependencies: ['ball-screw', 'linear-guide', 'manufactured-detail'],
  part,
} satisfies PartModule;
