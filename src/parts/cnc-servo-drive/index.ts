import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-servo-drive', catalogSelection };
export default { apiVersion: 2, order: 143.5, part, dependencies: [] } satisfies PartModule;
