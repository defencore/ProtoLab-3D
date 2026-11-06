import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'li-ion-pack' };
export default { apiVersion: 2, order: 110.1, part } satisfies PartModule;
