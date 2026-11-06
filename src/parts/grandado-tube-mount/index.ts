import type { PartModule } from '../../core/part-modules';
import definition from './part';
import { catalogSelection } from './configurator';
const part = { ...definition, id: 'grandado-tube-mount', catalogSelection };
export default {
  apiVersion: 2,
  order: 611,
  dependencies: [
    'manufactured-detail',
    'catalog-enclosure',
    'li-ion-battery-holder',
    'bolt-screw',
    'hex-nut',
    'washer',
    'li-ion-cell',
  ],
  part,
} satisfies PartModule;
