import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'toothed-washer', catalogSelection };
export default { apiVersion: 1, order: 44, part } satisfies PartModule;
