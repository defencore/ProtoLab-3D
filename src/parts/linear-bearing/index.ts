import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'linear-bearing', catalogSelection };
export default { apiVersion: 1, order: 10, part } satisfies PartModule;
