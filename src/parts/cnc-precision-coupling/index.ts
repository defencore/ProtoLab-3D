import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-precision-coupling', catalogSelection };
export default { apiVersion: 2, order: 64.8, part, dependencies: [] } satisfies PartModule;
