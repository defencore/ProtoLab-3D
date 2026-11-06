import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'flanged-ball-bearing', catalogSelection };
export default { apiVersion: 2, order: 0.5, part } satisfies PartModule;
