import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'bolt-screw', defaultSelection: true, catalogSelection };
export default { apiVersion: 1, order: 30, part } satisfies PartModule;
