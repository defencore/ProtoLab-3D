import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'lifting-eye-bolt', catalogSelection };
export default { apiVersion: 2, order: 29, part } satisfies PartModule;
