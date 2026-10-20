import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'square-nut', catalogSelection };
export default { apiVersion: 2, order: 37, part } satisfies PartModule;
