import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'linear-guide', catalogSelection };
export default { apiVersion: 1, order: 64, part } satisfies PartModule;
