import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'round-pneumatic-cylinder', catalogSelection };
export default { apiVersion: 2, order: 1310, part } satisfies PartModule;
