import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'gmp16-gearmotor', catalogSelection };
export default { apiVersion: 2, order: 95.1, part } satisfies PartModule;
