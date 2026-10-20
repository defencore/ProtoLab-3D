import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'multicopter-frame-component' };
export default { apiVersion: 2, order: 123.1, part } satisfies PartModule;
