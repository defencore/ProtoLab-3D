import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'plain-bearing', catalogSelection };
export default { apiVersion: 2, order: 24, part } satisfies PartModule;
