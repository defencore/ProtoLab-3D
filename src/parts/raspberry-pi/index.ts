import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'raspberry-pi', catalogSelection };
export default { apiVersion: 2, order: 101, part } satisfies PartModule;
