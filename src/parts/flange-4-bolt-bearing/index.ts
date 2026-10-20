import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'flange-4-bolt-bearing', catalogSelection };
export default { apiVersion: 2, order: 15, part } satisfies PartModule;
