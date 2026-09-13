import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'jaw-coupling', catalogSelection };
export default { apiVersion: 1, order: 69, part } satisfies PartModule;
