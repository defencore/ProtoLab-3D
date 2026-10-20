import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'metal-lock-nut', catalogSelection };
export default { apiVersion: 2, order: 41, part } satisfies PartModule;
