import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'nanopi', catalogSelection };
export default { apiVersion: 1, order: 102, part } satisfies PartModule;
