import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'chain-drive' };
export default { apiVersion: 1, order: 1219, part } satisfies PartModule;
