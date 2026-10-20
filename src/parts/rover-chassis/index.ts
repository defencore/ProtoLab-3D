import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'rover-chassis', catalogSelection };
export default { apiVersion: 2, dependencies: [], order: 125, part } satisfies PartModule;
