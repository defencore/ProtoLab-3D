import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'standard-battery', catalogSelection };
export default { apiVersion: 1, order: 111, part } satisfies PartModule;
