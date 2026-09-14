import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'servo-arm', catalogSelection };
export default { apiVersion: 1, order: 70.1, part } satisfies PartModule;
