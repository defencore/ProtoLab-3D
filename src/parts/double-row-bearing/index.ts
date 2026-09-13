import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'double-row-bearing', catalogSelection };
export default { apiVersion: 1, order: 3, part } satisfies PartModule;
