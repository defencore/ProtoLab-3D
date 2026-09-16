import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'industrial-motor' };
export default { apiVersion: 1, order: 1224, part } satisfies PartModule;
