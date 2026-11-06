import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters } from './configurator';
import { geometry, python, dimensions, validate, layout } from './lib/model';
import presets from './presets.json';
import profile from './product.json';

const part: PartDefinition = {
  id: 'printed-threaded-shell',
  name: 'Printed threaded enclosure component',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  product: profile as ProductProfile,
  icon: 'box',
  complexity: 'Authored printed component',
  description:
    'Reusable open can or closed cap with essential coarse helical geometry retained in preview and manufacturing exports.',
  keywords: [
    'printed thread',
    'screw cap',
    'enclosure',
    'screw interlock',
    'jar',
    'threaded shell',
    '3D printing',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['model', 'diameter', 'pitch', 'threadLength'],
  identityParameters(p) {
    const keys =
      p.model === 'cap'
        ? ['model', 'diameter', 'pitch', 'threadLength', 'wall', 'roof', 'roofGap', 'clearance']
        : ['model', 'diameter', 'pitch', 'height', 'threadLength', 'wall', 'floor'];
    return Object.fromEntries(keys.map((key) => [key, p[key]]));
  },
  updateParameters(p, changedKey) {
    if (changedKey !== 'model' || p.model !== 'body') return p;
    const d = layout(p),
      wallField = parameters.find((field) => field.key === 'wall')!,
      heightField = parameters.find((field) => field.key === 'height')!,
      wallMinimum = wallField.min!,
      wallStep = wallField.step!,
      heightMinimum = heightField.min!,
      heightStep = heightField.step!,
      maximumWall =
        wallMinimum + Math.floor((d.root - 5 - wallMinimum + 1e-9) / wallStep) * wallStep,
      minimumHeight =
        heightMinimum +
        Math.ceil((d.floor + d.length + 5 - heightMinimum - 1e-9) / heightStep) * heightStep;
    return {
      ...p,
      wall: Math.min(d.wall, maximumWall),
      height: Math.max(d.height, minimumHeight),
    };
  },
  validate: (p) => validate(p),
  buildGeometry: (p) => geometry(p),
  buildExportGeometry: (p) => geometry(p),
  python: (p) => python(p),
  dimensions: (p) => dimensions(p),
  notes:
    'Both Simple and Full retain the actual functional coarse thread. STL contains real helical flanks. This authored profile is not a standard fit gauge or a seal. The cap remains free to unscrew; no locking detent, pressure or ingress rating is included.',
  sources: [
    {
      label: 'Formlabs: printed threads and accessible metal fastening alternatives',
      url: 'https://formlabs.com/blog/adding-screw-threads-3d-printed-parts/',
    },
  ],
};
export default part;
