import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'thrust-roller-bearing', catalogSelection };
export default { apiVersion: 1, order: 20, part } satisfies PartModule;
