import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'profile-pneumatic-cylinder' };
export default { apiVersion: 2, order: 118.9, part } satisfies PartModule;
