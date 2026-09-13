import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'bevel-gear-pair', catalogSelection };
export default { apiVersion: 1, order: 62, part } satisfies PartModule;
