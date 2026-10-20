import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'cap-nut', catalogSelection };
export default { apiVersion: 2, order: 40, part } satisfies PartModule;
