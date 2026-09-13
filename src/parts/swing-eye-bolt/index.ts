import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'swing-eye-bolt', catalogSelection };
export default { apiVersion: 1, order: 28, part } satisfies PartModule;
