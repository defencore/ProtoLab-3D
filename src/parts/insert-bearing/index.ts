import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'insert-bearing', catalogSelection };
export default { apiVersion: 1, order: 17, part } satisfies PartModule;
