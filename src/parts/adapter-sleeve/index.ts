import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'adapter-sleeve', catalogSelection };
export default { apiVersion: 2, order: 25, part } satisfies PartModule;
