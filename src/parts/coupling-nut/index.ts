import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'coupling-nut', catalogSelection };
export default { apiVersion: 1, order: 35, part } satisfies PartModule;
