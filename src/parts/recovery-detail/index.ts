import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'recovery-detail' };
export default { apiVersion: 2, order: 19.7, part } satisfies PartModule;
