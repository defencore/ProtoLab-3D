import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'arduino', catalogSelection };
export default { apiVersion: 1, order: 107, part } satisfies PartModule;
