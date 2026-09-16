import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'dc-dc-converter', catalogSelection };
export default { apiVersion: 1, order: 100, part } satisfies PartModule;
