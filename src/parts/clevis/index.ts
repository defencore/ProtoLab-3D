import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';
export default {
  apiVersion: 1,
  order: 70.3,
  part: { ...definition, id: 'clevis', catalogSelection },
} satisfies PartModule;
