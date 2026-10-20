import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'li-ion-battery-holder' };
export default { apiVersion: 2, order: 1235, dependencies: [], part } satisfies PartModule;
