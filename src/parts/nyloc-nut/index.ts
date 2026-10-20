import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'nyloc-nut', catalogSelection };
export default { apiVersion: 2, order: 39, part } satisfies PartModule;
