import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'spring-pin', catalogSelection };
export default { apiVersion: 1, order: 51, part } satisfies PartModule;
