import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'machine-control' };
export default { apiVersion: 1, order: 1299, part } satisfies PartModule;
