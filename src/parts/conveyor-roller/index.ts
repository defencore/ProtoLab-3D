import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'conveyor-roller' };
export default { apiVersion: 2, order: 1289, part } satisfies PartModule;
