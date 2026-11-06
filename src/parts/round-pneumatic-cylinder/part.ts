import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';
import models from './lib/models.json';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { cylinderPieces } from './lib/model';
const part: PartDefinition = {
  id: 'round-pneumatic-cylinder',
  name: 'Round pneumatic cylinder',
  product: product as ProductProfile,
  category: 'PNEUMATICS & GAS',
  subgroup: 'CYLINDERS',
  icon: 'box',
  complexity: 'Fixed supplier executions; installation references',
  description:
    'Source-identified MA32×50-SCA and MA32×100-SCA magnetic round pneumatic cylinders with unresolved mounting geometry.',
  keywords: ['MA32', 'MA32x50-SCA', 'MA32x100-SCA', 'cylinder', 'pneumatic', 'magnetic', 'round'],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogFilterFields,
  presetMatchKeys: ['model'],
  validate(p, state) {
    const model = models.find((item) => item.id === p.model);
    const errors: string[] = [];
    if (!model) errors.push('Select a supported cylinder execution.');
    if (
      typeof p.extension !== 'number' ||
      !Number.isFinite(p.extension) ||
      p.extension < 0 ||
      p.extension > (model?.stroke ?? 0)
    )
      errors.push('Extension must remain within the selected cylinder stroke.');
    if (Object.keys(p).some((key) => !['model', 'extension'].includes(key)))
      errors.push('Purchased cylinder dimensions are fixed.');
    if (state !== 'default') errors.push('Select the cylinder exterior state.');
    return errors;
  },
  updateParameters(p, key) {
    if (key !== 'model') return p;
    const model = models.find((item) => item.id === p.model);
    return { ...p, extension: Math.min(model?.stroke ?? 0, Math.max(0, +p.extension || 0)) };
  },
  buildGeometry: (p) => assembly.geometry(cylinderPieces(p)),
  dimensions: (p) => assembly.dimensions(cylinderPieces(p)),
  python: (p) => assembly.python(cylinderPieces(p)),
  notes:
    'One purchased supplier unit. Envelope geometry remains provisional: mounting, cap, port and closed-length details require an execution drawing or measured product. No source CAD or internal pressure geometry is claimed.',
  sources: models.map((model) => ({
    label: model.name + ' supplier identity and specifications',
    url: model.source,
  })),
};
export default part;
