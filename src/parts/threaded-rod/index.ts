import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'threaded-rod', catalogSelection };
export default { apiVersion: 2, order: 45, dependencies: ['set-screw'], part } satisfies PartModule;
