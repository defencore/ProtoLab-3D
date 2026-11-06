import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  box,
  cylinder,
  subtract,
  union,
  component,
  pythonShape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';
export const moduleLength = (p: Parameters) => Number(String(p.format).slice(2));
function shape(p: Parameters) {
  const l = moduleLength(p);
  return union(
    subtract(box([l, 22, 1], [-l / 2, -11, 0]), cylinder(1.75, 3, [-l / 2, 0, -1])),
    box([l - 10, 18, 2.5], [-l / 2 + 5, -9, 1]),
  );
}
const part: PartDefinition = {
  id: 'm2-ssd',
  browseLabel: 'M.2 NVMe SSD',
  name: 'M.2 NVMe SSD installation reference',
  category: 'ELECTRONICS & VISION',
  subgroup: 'STORAGE & ADAPTERS',
  icon: 'circuit',
  complexity: 'Generic module envelope',
  description: 'A replaceable M.2 storage-module envelope for board stacking and retention layout.',
  keywords: ['M.2', 'NVMe', 'SSD', '2280', '2242', '2230', 'Raspberry Pi 5', 'Waveshare'],
  defaults,
  parameters,
  presets: presets as Preset[],
  product: product as ProductProfile,
  catalogSelection: [],
  validate: (p) =>
    ['2230', '2242', '2280'].includes(String(p.format))
      ? []
      : ['Choose a supported M.2 module format.'],
  buildGeometry: (p) => new Group().add(component(shape(p), 'Generic M.2 module', 0x3b5550)),
  python: (p) => `shape = ${pythonShape(shape(p))}`,
  dimensions: (p) => [moduleLength(p), 22, 3.5],
  notes:
    'Longitudinal X, connector end +X, PCB bottom Z=0 and component envelope to Z=3.5. Width/length follow the named form factor; PCB thickness, component thickness and end-notch geometry are authored layout assumptions. This is not a particular supplier SSD. Select a real NVMe model and thermal solution before release.',
};
export default part;
