import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'plain-bushing' };
export default { apiVersion: 1, order: 1207, part } satisfies PartModule;
