import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spherical-roller-bearing', catalogSelection };
export default { apiVersion: 1, order: 6, part } satisfies PartModule;
