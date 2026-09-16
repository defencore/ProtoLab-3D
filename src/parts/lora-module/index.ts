import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'lora-module', catalogSelection };
export default { apiVersion: 1, order: 105, part } satisfies PartModule;
