import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spiral-spring', catalogSelection };
export default { apiVersion: 2, order: 57, part } satisfies PartModule;
