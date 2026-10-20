import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'cotter-pin', catalogSelection };
export default { apiVersion: 2, order: 52, part } satisfies PartModule;
