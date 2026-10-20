import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'prototyping-board' };
export default { apiVersion: 2, order: 1440, dependencies: [], part } satisfies PartModule;
