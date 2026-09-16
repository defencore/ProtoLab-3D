import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'lifting-surface' };
export default { apiVersion: 1, order: 93, part } satisfies PartModule;
