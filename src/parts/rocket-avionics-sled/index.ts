import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'rocket-avionics-sled' };
export default { apiVersion: 2, order: 122.5, part } satisfies PartModule;
