import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'roller-bearing', catalogSelection };
export default { apiVersion: 1, order: 5, part } satisfies PartModule;
