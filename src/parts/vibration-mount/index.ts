import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'vibration-mount' };
export default { apiVersion: 2, order: 1210, part } satisfies PartModule;
