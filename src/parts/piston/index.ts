import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'piston', catalogSelection };
export default { apiVersion: 1, order: 70.4, part } satisfies PartModule;
