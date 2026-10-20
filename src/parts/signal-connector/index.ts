import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'signal-connector' };
export default { apiVersion: 2, order: 1420, dependencies: [], part } satisfies PartModule;
