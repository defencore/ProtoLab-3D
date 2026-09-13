import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'wheel', catalogSelection };
export default { apiVersion: 1, order: 73, part } satisfies PartModule;
