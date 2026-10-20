import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-precision-support', catalogSelection };
export default { apiVersion: 2, order: 64.6, part, dependencies: [] } satisfies PartModule;
