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
  id: 'shaft-end-drill-jig',
  name: 'Shaft end-centering drill guide',
  category: 'WORKSHOP TOOLS',
  subgroup: 'DRILLING JIGS',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description: 'Slip-on end stop for centered axial pilot holes in rods and small tube end plugs.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'shaft end',
    'axial',
    'center drilling',
    'rod',
    'centering',
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
        'Use on a measured round shaft. Insert its end until it meets the cap shoulder, clamp the shaft and sleeve, and spot-drill through the axial guide. Do not use a loose fit as a precision center. The fixture is for stationary drilling, not for a rotating lathe spindle.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Use on a measured round shaft. Insert its end until it meets the cap shoulder, clamp the shaft and sleeve, and spot-drill through the axial guide. Do not use a loose fit as a precision center. The fixture is for stationary drilling, not for a rotating lathe spindle.',
  sources: [
    {
      label: 'Carr Lane drill-bushing application guidance',
      url: 'https://www.carrlane.com/engineering-resources/technical-information/manual-workholding/drill-bushings',
    },
  ],
};
export default part;
