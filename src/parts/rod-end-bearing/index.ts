import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'rod-end-bearing', catalogSelection };
export default { apiVersion: 2, order: 9, part } satisfies PartModule;
