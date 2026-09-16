import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'multicopter-frame', catalogSelection };
export default { apiVersion: 1, order: 123, part } satisfies PartModule;
