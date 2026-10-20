import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'strut' };
export default { apiVersion: 2, order: 1215, part } satisfies PartModule;
