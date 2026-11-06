import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'recovery-electronics-mount' };
export default { apiVersion: 2, order: 1412, part } satisfies PartModule;
