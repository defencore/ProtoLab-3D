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
  id: 'manual-miter-guide',
  name: 'Manual saw miter box with end stop',
  category: 'WORKSHOP TOOLS',
  subgroup: 'CUTTING & SAWING GUIDES',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description:
    'Clamped hand-saw guide for repeatable crosscuts and angled cuts in small strip and tube stock.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'manual saw',
    'miter',
    'mitre',
    'angle cutting',
    'end stop',
    'repeat length',
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
        'Clamp the miter box and removable stop, then clamp the stock against the side and stop datums. Use a fine manual saw fitting the chosen slot. Stop distance is measured at the stock centerline; the long/short edges differ on angled cuts. This printed box is not a guide for a running circular saw, angle grinder, bandsaw or powered miter saw.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Clamp the miter box and removable stop, then clamp the stock against the side and stop datums. Use a fine manual saw fitting the chosen slot. Stop distance is measured at the stock centerline; the long/short edges differ on angled cuts. This printed box is not a guide for a running circular saw, angle grinder, bandsaw or powered miter saw.',
  sources: [],
};
export default part;
