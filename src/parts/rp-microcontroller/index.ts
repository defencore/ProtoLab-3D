import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'rp-microcontroller', catalogSelection };
export default { apiVersion: 1, order: 106, part } satisfies PartModule;
