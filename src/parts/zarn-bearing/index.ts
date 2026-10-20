import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'zarn-bearing', catalogSelection };
export default { apiVersion: 2, order: 23, part } satisfies PartModule;
