import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'conical-washer', catalogSelection };
export default { apiVersion: 1, order: 43, part } satisfies PartModule;
