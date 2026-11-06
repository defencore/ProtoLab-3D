import type { PartModule } from '../../core/part-modules';
import definition from './part';

const part = {
  ...definition,
  id: 'handheld-lora-controller',
  browseLabel: 'Handheld LoRa controller',
};
export default {
  apiVersion: 2,
  order: 1402,
  dependencies: [
    'manufactured-detail',
    'panel-switch',
    'lora-module',
    'bolt-screw',
    'hex-nut',
    'nyloc-nut',
    'washer',
    'rf-pigtail',
  ],
  part,
} satisfies PartModule;
