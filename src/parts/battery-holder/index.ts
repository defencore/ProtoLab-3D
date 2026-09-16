import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'battery-holder' };
export default { apiVersion: 1, order: 1240, part } satisfies PartModule;
