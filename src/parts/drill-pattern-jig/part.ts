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
  id: 'drill-pattern-jig',
  name: 'Flange and grid drilling jig',
  category: 'WORKSHOP TOOLS',
  subgroup: 'DRILLING JIGS',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description: 'Referenced guide plate for bolt circles, rows, rectangular patterns and flanges.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'flange',
    'bolt circle',
    'PCD',
    'grid',
    'hole pattern',
    'mounting plate',
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
        'Clamp the two underside fences against perpendicular workpiece edges. Spot all positions, drill through a steel bushing or transfer pilot marks, and remove the fixture before enlarging or tapping holes. For a round flange, first locate its center relative to the two edge datums using a sacrificial carrier or stops; this plate does not self-center on an arbitrary circular blank.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Clamp the two underside fences against perpendicular workpiece edges. Spot all positions, drill through a steel bushing or transfer pilot marks, and remove the fixture before enlarging or tapping holes. For a round flange, first locate its center relative to the two edge datums using a sacrificial carrier or stops; this plate does not self-center on an arbitrary circular blank.',
  sources: [
    {
      label: 'Carr Lane drill-bushing application guidance',
      url: 'https://www.carrlane.com/engineering-resources/technical-information/manual-workholding/drill-bushings',
    },
  ],
};
export default part;
