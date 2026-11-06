import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'pneumatic-valve' };
export default { apiVersion: 2, order: 119.1, part } satisfies PartModule;
