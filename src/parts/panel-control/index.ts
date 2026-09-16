import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'panel-control' };
export default { apiVersion: 1, order: 1242, part } satisfies PartModule;
