import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'round-linear-guide', catalogSelection };
export default { apiVersion: 2, dependencies: ['manufactured-detail'], order: 65, part } satisfies PartModule;
