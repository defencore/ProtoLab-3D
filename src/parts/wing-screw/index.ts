import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'wing-screw', catalogSelection };
export default { apiVersion: 1, order: 27, part } satisfies PartModule;
