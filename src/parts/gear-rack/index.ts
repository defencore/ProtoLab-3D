import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'gear-rack', catalogSelection };
export default { apiVersion: 1, order: 63, part } satisfies PartModule;
