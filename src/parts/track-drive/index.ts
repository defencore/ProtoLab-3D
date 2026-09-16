import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'track-drive' };
export default { apiVersion: 1, order: 1249, part } satisfies PartModule;
