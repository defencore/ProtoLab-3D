import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'sheet-bracket' };
export default { apiVersion: 1, order: 1228, part } satisfies PartModule;
