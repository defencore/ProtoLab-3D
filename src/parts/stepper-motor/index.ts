import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'stepper-motor', catalogSelection };
export default { apiVersion: 1, order: 94, part } satisfies PartModule;
