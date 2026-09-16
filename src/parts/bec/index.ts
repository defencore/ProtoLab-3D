import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'bec', catalogSelection };
export default { apiVersion: 1, order: 98, part } satisfies PartModule;
