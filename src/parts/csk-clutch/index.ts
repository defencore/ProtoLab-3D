import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'csk-clutch', catalogSelection };
export default { apiVersion: 2, order: 19, part } satisfies PartModule;
