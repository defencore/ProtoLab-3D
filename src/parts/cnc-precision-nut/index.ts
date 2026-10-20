import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'cnc-precision-nut', catalogSelection };
export default { apiVersion: 2, order: 64.5, part, dependencies: [] } satisfies PartModule;
