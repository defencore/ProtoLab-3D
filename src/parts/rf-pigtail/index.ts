import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'rf-pigtail', catalogSelection };
export default { apiVersion: 2, order: 106, part } satisfies PartModule;
