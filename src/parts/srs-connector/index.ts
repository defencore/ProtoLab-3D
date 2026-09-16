import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'srs-connector', catalogSelection };
export default { apiVersion: 1, order: 108, part } satisfies PartModule;
