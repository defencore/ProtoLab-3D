import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'thrust-bearing', catalogSelection };
export default { apiVersion: 1, order: 13, part } satisfies PartModule;
