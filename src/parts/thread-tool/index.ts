import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'thread-tool', catalogSelection };
export default { apiVersion: 1, order: 112, part } satisfies PartModule;
