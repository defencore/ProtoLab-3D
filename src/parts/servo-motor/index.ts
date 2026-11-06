import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'servo-motor', catalogSelection,
  browseFamily: { id: 'servo-motors', label: 'Servo motors', primary: true } };
export default { apiVersion: 2, order: 83, part } satisfies PartModule;
