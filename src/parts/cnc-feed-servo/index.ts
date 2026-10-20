import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-feed-servo', catalogSelection };
export default { apiVersion: 2, order: 64.4, part, dependencies: [] } satisfies PartModule;
