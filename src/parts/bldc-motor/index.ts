import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'bldc-motor', catalogSelection };
export default { apiVersion: 1, order: 95, part } satisfies PartModule;
