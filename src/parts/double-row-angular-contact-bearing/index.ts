import definition from './part';
import { catalogSelection } from './configurator';
import type { PartModule } from '../../core/part-modules';

const part = { ...definition, id: 'double-row-angular-contact-bearing', catalogSelection };
export default { apiVersion: 1, order: 4, part } satisfies PartModule;
