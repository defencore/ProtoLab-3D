import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'square-washer', catalogSelection };
export default { apiVersion: 1, order: 42, part } satisfies PartModule;
