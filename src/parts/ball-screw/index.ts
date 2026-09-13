import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'ball-screw', catalogSelection };
export default { apiVersion: 1, order: 66, part } satisfies PartModule;
