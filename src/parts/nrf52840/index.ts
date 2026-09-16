import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'nrf52840', catalogSelection };
export default { apiVersion: 1, order: 104, part } satisfies PartModule;
