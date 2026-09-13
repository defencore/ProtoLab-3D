import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spherical-thrust-bearing', catalogSelection };
export default { apiVersion: 1, order: 21, part } satisfies PartModule;
