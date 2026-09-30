import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'circular-saw-blade' };
export default { apiVersion: 1, order: 1279, part } satisfies PartModule;
