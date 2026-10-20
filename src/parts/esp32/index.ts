import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'esp32', catalogSelection };
export default { apiVersion: 2, order: 103, part } satisfies PartModule;
