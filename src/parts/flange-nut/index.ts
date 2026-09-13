import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'flange-nut', catalogSelection };
export default { apiVersion: 1, order: 38, part } satisfies PartModule;
