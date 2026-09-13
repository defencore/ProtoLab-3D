import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'self-aligning-bearing', catalogSelection };
export default { apiVersion: 1, order: 1, part } satisfies PartModule;
