import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'boat-hull', catalogSelection };
export default { apiVersion: 1, order: 122, part } satisfies PartModule;
