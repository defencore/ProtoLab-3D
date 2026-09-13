import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'compression-spring', catalogSelection };
export default { apiVersion: 1, order: 53, part } satisfies PartModule;
