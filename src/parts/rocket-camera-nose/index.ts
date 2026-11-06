import type { PartModule } from '../../core/part-modules';
import part from './part';
export default {
  apiVersion: 2,
  order: 124.6,
  dependencies: [
    'manufactured-detail',
    'raspberry-pi',
    'waveshare-ups-3s',
    'waveshare-pcie-m2-d',
    'board-camera-19',
    'waveshare-ov9281-110',
    'optical-dome-window',
    'li-ion-cell',
    'm2-ssd',
    'gps-tracker',
    'jhe42b-finder',
    'bolt-screw',
    'hex-nut',
    'nyloc-nut',
    'spacer',
    'washer',
    'threaded-rod',
  ],
  part: { ...part, id: 'rocket-camera-nose' },
} satisfies PartModule;
