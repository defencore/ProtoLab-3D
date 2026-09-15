import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';

const part = { ...definition, id: 'tubular-solenoid', catalogSelection };
export default { apiVersion: 1, order: 81, part } satisfies PartModule;
