import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'flight-controller', catalogSelection };
export default { apiVersion: 1, order: 97, part } satisfies PartModule;
