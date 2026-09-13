import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'ball-bearing', catalogSelection };
export default { apiVersion: 1, order: 0, part } satisfies PartModule;
