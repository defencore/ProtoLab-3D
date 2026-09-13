import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'flange-2-bolt-bearing', catalogSelection };
export default { apiVersion: 1, order: 14, part } satisfies PartModule;
