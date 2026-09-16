import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'din-rail' };
export default { apiVersion: 1, order: 1239, part } satisfies PartModule;
