import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'lifting-eye-nut', catalogSelection };
export default { apiVersion: 1, order: 34, part } satisfies PartModule;
