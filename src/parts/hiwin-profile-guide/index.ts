import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'hiwin-profile-guide' };
export default { apiVersion: 2, order: 63.9, part } satisfies PartModule;
