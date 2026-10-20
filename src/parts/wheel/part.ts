import { wheelComposition, wheelPieces } from './lib/composition';
import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { detailGeometry, detailPython } from '../../core/assembly/detail-instances';
import manufacturedPart from '../manufactured-detail/part';
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
const values = (p: Parameters) => ({
  r: n(p, 'diameter') / 2,
  w: n(p, 'width'),
  bore: n(p, 'bore') / 2,
  hub: n(p, 'hubDiameter') / 2,
  hubLength: n(p, 'hubLength'),
});
const part: PartDefinition = {
  id: 'wheel',
  composition: wheelComposition,
  product: productData as ProductProfile,
  name: 'Utility wheel',
  category: 'STRUCTURAL PARTS',
  subgroup: 'WHEELS & ROLLERS',
  icon: 'wheel',
  complexity: '5 parameters',
  description: 'A compact wheel with a tire ring, recessed rim and open axle hub.',
  keywords: ['wheel', 'roller', 'tire', 'robot', 'cart', 'axle', 'hub'],
  parameters: [
    numberParameter('diameter', 'Wheel diameter', 'D', 'Wheel', 15, 300),
    numberParameter('width', 'Tire width', 'W', 'Wheel', 3, 100),
    numberParameter('bore', 'Axle bore', 'd', 'Hub', 1, 60),
    numberParameter('hubDiameter', 'Hub diameter', 'H', 'Hub', 4, 100),
    numberParameter('hubLength', 'Hub length', 'L', 'Hub', 3, 120),
  ],
  defaults: { diameter: 60, width: 18, bore: 5, hubDiameter: 18, hubLength: 24 },
  presets: modulePresets,
  validate(p) {
    const { r, bore, hub, hubLength, w } = values(p);
    const errors: string[] = [];
    if (hub <= bore) errors.push('Hub diameter must exceed the axle bore.');
    if (hub >= r * 0.78) errors.push('Hub diameter must be less than 78% of the wheel diameter.');
    if (hubLength < w * 0.6) errors.push('Hub length must be at least 60% of the tire width.');
    return errors;
  },
  buildGeometry: (p) => detailGeometry(manufacturedPart, wheelPieces(p)),
  python: (p) => detailPython(manufacturedPart, wheelPieces(p)),
  dimensions(p) {
    const { r, w, hubLength } = values(p);
    return [2 * r, 2 * r, Math.max(w, hubLength)];
  },
  notes:
    'The preview distinguishes tire and rim with color; the FreeCAD assembly separates the tire from the fused rim and hub. Smooth tire with no tread, bearings, keyway or axle retention.',
};
export default { ...part, presets: modulePresets };
