import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'vehicle-mounting-plate', catalogSelection };
export default { apiVersion: 2, order: 129.1, part } satisfies PartModule;
