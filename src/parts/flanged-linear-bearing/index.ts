import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'flanged-linear-bearing', catalogSelection };
export default { apiVersion: 1, order: 11, part } satisfies PartModule;
