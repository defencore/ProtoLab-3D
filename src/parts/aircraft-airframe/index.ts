import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'aircraft-airframe', catalogSelection };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 120, part } satisfies PartModule;
