import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'threaded-rod', catalogSelection };
export default { apiVersion: 1, order: 45, part } satisfies PartModule;
