import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = { ...definition, id: 'servo-toggle-actuator', browseLabel: 'Servo toggle actuator' };
export default {
  apiVersion: 2,
  order: 1401,
  dependencies: [
    'bus-servo',
    'bus-servo-driver',
    'lora-module',
    'adc-module',
    'bec',
    'power-filter',
    'pwm-switch',
    'li-ion-pack',
    'panel-switch',
    'electrical-connector',
    'laboratory-terminal',
    'panel-indicator',
    'waterproof-connector',
    'purchased-component',
    'manufactured-detail',
    'bolt-screw',
    'hex-nut',
    'washer',
  ],
  part,
} satisfies PartModule;
