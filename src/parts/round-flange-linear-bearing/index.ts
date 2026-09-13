import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'round-flange-linear-bearing', catalogSelection };
export default { apiVersion: 1, order: 12, part } satisfies PartModule;
