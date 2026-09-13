import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'set-screw', catalogSelection };
export default { apiVersion: 1, order: 31, part } satisfies PartModule;
