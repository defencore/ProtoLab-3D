import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'wing-rib' };
export default { apiVersion: 2, order: 126, part } satisfies PartModule;
