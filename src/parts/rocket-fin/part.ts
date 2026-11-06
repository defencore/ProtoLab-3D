import { Group } from 'three';
import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { component, pythonShape } from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import { finShape, finDimensions, freeformPoints } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'rocket-fin',
  name: 'Rocket planar fin',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'wing',
  complexity: 'Trapezoidal / elliptical / freeform',
  product: product as ProductProfile,
  description:
    'One configurable flat fin with a trapezoidal, half-elliptical or simple freeform planform, corresponding to OpenRocket fin component types.',
  keywords: [
    'OpenRocket',
    'LDRS',
    'Large Dangerous Rocket Ships',
    'high power rocketry',
    'trapezoidal fin',
    'elliptical fin',
    'freeform fin',
    'fin set',
    'stabilizer',
    'plate',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: ['shape', 'rootChord', 'tipChord', 'span', 'sweep', 'thickness'],
  validate(p, state) {
    if (state !== 'default') return ['Select the physical fin detail.'];
    const errors: string[] = [];
    for (const field of parameters) {
      const value = p[field.key];
      if (
        field.type === 'number' &&
        (typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < field.min! ||
          value > field.max!)
      )
        errors.push(`${field.label} is outside its supported finite range.`);
      if (field.type === 'select' && !field.options?.some((option) => option.value === value))
        errors.push('Select a supported fin planform.');
      if (field.type === 'text' && typeof value !== 'string')
        errors.push('Outline points must be JSON text.');
    }
    if (errors.length) return errors;
    if (p.shape === 'freeform') {
      try {
        freeformPoints(String(p.points));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Invalid freeform outline.');
      }
    }
    return errors;
  },
  buildGeometry: (p) => new Group().add(component(finShape(p), 'Planar rocket fin', 0xd3b77d)),
  python: (p) => `shape = ${pythonShape(finShape(p))}`,
  dimensions: finDimensions,
  notes:
    'One physical fin only; add separate project occurrences to arrange a fin set. X is the axial chord direction, Y is radial and Z is plate thickness centered at zero. The elliptical outline is a 64-segment half-ellipse shared by preview and native CAD; edge bevel, airfoil section, root tab, fillets and attachment hardware are not modeled. All dimensions are authored prototypes. OpenRocket names identify component classes, not imported supplier products or file-format compatibility.',
  sources: [
    {
      label: 'OpenRocket available fin component types',
      url: 'https://openrocket.readthedocs.io/en/latest/user_guide/basic_rocket_design.html#body-components-and-fin-sets',
    },
  ],
};
export default part;
