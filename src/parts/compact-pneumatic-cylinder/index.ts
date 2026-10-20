import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'compact-pneumatic-cylinder' };
export default { apiVersion: 2, order: 1309, part } satisfies PartModule;
