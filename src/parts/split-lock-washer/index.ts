import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'split-lock-washer', catalogSelection };
export default { apiVersion: 1, order: 50, part } satisfies PartModule;
