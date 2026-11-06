import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'rov-component' };
export default { apiVersion: 2, order: 126.1, part } satisfies PartModule;
