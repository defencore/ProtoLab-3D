import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'camera', catalogSelection };
export default { apiVersion: 1, order: 96, part } satisfies PartModule;
