import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'linkage-mechanism' };
export default { apiVersion: 1, order: 1253, part } satisfies PartModule;
