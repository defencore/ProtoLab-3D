import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'tapered-roller-bearing', catalogSelection };
export default { apiVersion: 1, order: 7, part } satisfies PartModule;
