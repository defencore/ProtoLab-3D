import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'cnc-spindle-mount' };
export default { apiVersion: 2, order: 1207.2, part } satisfies PartModule;
