import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters, catalogFilterFields } from './configurator';
import presets from './presets.json';
import { hatGeometry, hatPython, hatData } from './lib/hat';
const part: PartDefinition = {
  id: 'bus-servo-driver',
  name: 'Bus Servo Driver HAT (A)',
  category: 'POWER & MOTOR CONTROL',
  subgroup: 'SERVO CONTROLLERS',
  icon: 'circuit',
  complexity: 'Supplier STEP assembly',
  description: 'Waveshare ESP32 bus-servo controller · 9–25 V · USB-C / UART / Wi-Fi.',
  keywords: ['Waveshare', '27577', 'ESP32', 'ST3215', 'HAT', 'servo driver',],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Manufacturer PCB and fitted components; mating cables excluded.',
    },
  ],
  validate(p, state) {
    return p.model !== 'waveshare-hat-a' ||
      Object.keys(p).some((k) => k !== 'model') ||
      state !== 'assembled'
      ? ['Select the fixed Waveshare HAT (A) assembly.']
      : [];
  },
  buildGeometry: () => hatGeometry(),
  dimensions: () => [
    hatData.bounds[3] - hatData.bounds[0],
    hatData.bounds[4] - hatData.bounds[1],
    hatData.bounds[5] - hatData.bounds[2],
  ],
  python: () =>
    [
      ...hatPython,
      'shape=Part.makeCompound([_hat_native()])',
      'component_labels=["BUY Waveshare Bus Servo Driver HAT (A) · SKU 27577 · ESP32 · 9–25 V"]',
    ].join('\n'),
  notes:
    'Official supplier STEP, including connectors and underside components. PCB 57×65 mm; four Ø3 mounting holes at 49×58 mm. Input 9–25 V must match the servo; the servo rail is not a 12 V regulator. 3S Li-ion is for the standard ST3215 12 V version (6–12.6 V), not ST3215-7.4V. Mounting cables and host are excluded. Two invalid small underside IC solids use their measured envelopes; one connector received a topology repair. Colours are illustrative.',
  sources: [
    { label: 'Waveshare product', url: 'https://www.waveshare.com/bus-servo-driver-hat-a.htm' },
    {
      label: 'Waveshare documentation / STEP / drawing',
      url: 'https://www.waveshare.com/wiki/Bus_Servo_Driver_HAT_(A)',
    },
  ],
};
export default part;
