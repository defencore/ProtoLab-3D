import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'lead-screw-axis' };
export default { apiVersion: 1, order: 1222, part } satisfies PartModule;
