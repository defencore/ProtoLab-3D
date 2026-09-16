import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'srs-retainer', catalogSelection };
export default { apiVersion: 1, order: 115, part } satisfies PartModule;
