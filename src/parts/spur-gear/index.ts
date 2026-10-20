import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spur-gear', catalogSelection };
export default { apiVersion: 2, order: 59, part } satisfies PartModule;
