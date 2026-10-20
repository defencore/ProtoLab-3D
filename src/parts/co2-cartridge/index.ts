import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'co2-cartridge' };
export default { apiVersion: 2, order: 113, part } satisfies PartModule;
