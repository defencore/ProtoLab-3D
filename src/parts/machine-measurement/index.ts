import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'machine-measurement' };
export default { apiVersion: 1, order: 1300, part } satisfies PartModule;
