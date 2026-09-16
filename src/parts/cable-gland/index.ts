import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cable-gland' };
export default { apiVersion: 1, order: 1244, part } satisfies PartModule;
