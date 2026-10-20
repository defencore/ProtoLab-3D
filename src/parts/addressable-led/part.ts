import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/electronics/assembly';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { models, selected, pieces } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'addressable-led',
  name: 'Addressable LED module',
  category: 'ELECTRONICS & VISION',
  subgroup: 'LED MODULES',
  icon: 'circuit',
  product: product as ProductProfile,
  complexity: 'WS2812B · sticks, matrices and rings',
  description:
    'WS2812B 5050 RGB modules: 1×8 stick, 2×2 and 4×4 matrices, and 8/12/16/24-pixel rings. Solder pads and mounting openings, without wires.',
  keywords: [
    'NeoPixel',
    'WS2812',
    'WS2812B',
    '2812',
    'WS2812B-4',
    'CJMCU-2812-8',
    'RGB',
    'addressable',
    '8-Bit',
    '1x8',
    '2x2',
    '4x4',
    'ring',
    'annular',
    'CEL03109',
    'CEL03110',
    'CEL03111',
    'CEL03112',
    'LCD03022',
    'LED',
    'CEL03113',
    'LCD03021',
  ],
  defaults,
  parameters,
  presets: presets as unknown as Preset[],
  catalogFilterFields,
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model', label: 'LED module' }],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Populated module without wires, pin headers or mounting hardware.',
    },
    {
      id: 'exploded',
      label: 'Separate components',
      description: 'Inspect the PCB, LED packages and passives as one purchased module.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Choose a supported LED module.');
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Choose assembly or component inspection.');
    for (const key of Object.keys(p))
      if (key !== 'model')
        errors.push('Module dimensions are fixed; unsupported parameter: ' + key + '.');
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  assessment(p) {
    const m = selected(p);
    return [
      `${m.layout} · ${m.leds} WS2812B 5050 RGB LEDs · solder-pad connections.`,
      m.outline === 'ring'
        ? `Published outside diameter: ${m.length} mm. Model opening about ${m.innerDiameter} mm and model height ${m.height} mm are approximate.`
        : `Supplier envelope: ${m.length} × ${m.width} × ${m.height} mm.`,
      'Mounting-hole and component coordinates are reconstructed from photographs; check the delivered board before drilling its enclosure.',
    ];
  },
  notes:
    "Mechanical reconstructions of the selected generic BOT'n ROLL modules, not original manufacturer CAD. Published outer dimensions are retained; PCB thickness, mounting bores, package pitch, solder pads and component positions are approximate. Tiny optical die silhouettes are illustrative. Ring outside diameters and rectangular module envelopes are published supplier values. Ring heights and inner openings are authored/photo-derived approximations; only published dimensions are catalogued as verified. The 2×2-module page has an erroneous eight-LED specification bullet; its title, description and photographs show four. Ring rear pads follow a common four-land generic layout; the selected supplier does not publish rear routing. The model omits wires, headers, solder joints, copper routing and mounting hardware. NeoPixel is a discovery/compatibility term; no Adafruit origin is claimed. Electrical and optical simulation are not provided.",
  sources: models.map((m) => ({ label: `${m.supplier} · ${m.designation}`, url: m.source })),
};
export default part;
