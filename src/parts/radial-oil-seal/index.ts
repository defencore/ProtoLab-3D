import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'radial-oil-seal', catalogSelection };
export default { apiVersion: 1, order: 26, part } satisfies PartModule;
