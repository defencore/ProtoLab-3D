import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'pcb-standoff' };
export default { apiVersion: 2, order: 72.1, part } satisfies PartModule;
