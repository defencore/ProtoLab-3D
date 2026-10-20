import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'li-ion-cell', catalogSelection };
export default { apiVersion: 2, order: 110, part } satisfies PartModule;
