import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'lipo-battery', catalogSelection };
export default { apiVersion: 1, order: 109, part } satisfies PartModule;
