import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part = { ...definition, id: 'panel-battery-module' };
export default {
  apiVersion: 2,
  order: 605,
  dependencies: [
    'manufactured-detail',
    'purchased-component',
    'li-ion-battery-holder',
    'electrical-connector',
    'signal-connector',
    'compression-spring',
  ],
  part,
} satisfies PartModule;
