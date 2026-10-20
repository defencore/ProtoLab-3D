import type { PartModule } from '../../core/part-modules';
import partDefinition from './part';
const part = { ...partDefinition, id: 'cnc-process-accessory' };
export default { apiVersion: 2, order: 1317.4, dependencies: [], part } satisfies PartModule;
