import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'e-ring', catalogSelection };
export default { apiVersion: 1, order: 49, part } satisfies PartModule;
