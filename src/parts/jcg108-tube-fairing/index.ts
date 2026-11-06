import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = { ...definition, id: 'jcg108-tube-fairing', catalogSelection };

export default {
  apiVersion: 2,
  order: 612,
  dependencies: ['manufactured-detail', 'adhesive-antenna', 'bolt-screw'],
  part,
} satisfies PartModule;
