import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'washer', catalogSelection };
export default { apiVersion: 1, order: 47, part } satisfies PartModule;
