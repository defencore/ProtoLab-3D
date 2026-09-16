import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'esc', catalogSelection };
export default { apiVersion: 1, order: 99, part } satisfies PartModule;
