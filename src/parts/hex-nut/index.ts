import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'hex-nut', catalogSelection };
export default { apiVersion: 1, order: 46, part } satisfies PartModule;
