import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import detail from '../manufactured-detail/part';
import purchased from '../purchased-component/part';
import { defaults, parameters } from './configurator';
import { pieces, validate, assessment } from './lib/model';
import { configured } from './lib/common';
import profile from './product.json';
import presets from './presets.json';
const libraries = [detail, purchased];
const part: PartDefinition = {
  id: 'wire-bending-jig',
  name: 'Pin and mandrel wire-bending jig',
  category: 'WORKSHOP TOOLS',
  subgroup: 'BENDING & ASSEMBLY JIGS',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description:
    'Simple loop and U-bend tooling with replaceable metal mandrels and a drilled mounting plate.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'wire bending',
    'U bend',
    'loop',
    'mandrel',
    'pin jig',
    'metal plate',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  product: profile as ProductProfile,
  states: [
    {
      id: 'assembled',
      label: 'Working setup',
      description: 'Configured physical parts in their working or kit positions.',
    },
    {
      id: 'exploded',
      label: 'Separate components',
      description: 'Inspection separation only; the physical bill of materials stays unchanged.',
    },
  ],
  validate(p) {
    const errors = parameters
      .filter(
        (f) =>
          f.type === 'number' &&
          f.unit === '' &&
          f.step === 1 &&
          !Number.isInteger(Number(p[f.key])),
      )
      .map((f) => f.label + ' must be a whole number.');
    if (p.guide === 'bushing' && Number(p.bushOD) <= Number(p.drill) + 1.5)
      errors.push('Bushing OD must leave at least 0.75 mm radial wall around the drill bore.');
    return [...errors, ...validate(p)];
  },
  assessment,
  composition(p) {
    return {
      components: configured(pieces(p), 'assembled').map((piece) => piece.component),
      issues: [
        'Make the base from metal plate using the model as a drilling layout, secure mandrels and pins mechanically from beneath, and clamp the plate to a bench. Bend suitable soft wire by hand around the mandrels. Test springback and length allowance on a sample. A printed base is only a layout/light-duty prototype; it is not qualified tooling for steel strip or high-force bending.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Make the base from metal plate using the model as a drilling layout, secure mandrels and pins mechanically from beneath, and clamp the plate to a bench. Bend suitable soft wire by hand around the mandrels. Test springback and length allowance on a sample. A printed base is only a layout/light-duty prototype; it is not qualified tooling for steel strip or high-force bending.',
  sources: [],
};
export default part;
