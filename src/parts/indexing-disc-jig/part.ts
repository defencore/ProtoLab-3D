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
  id: 'indexing-disc-jig',
  name: 'Manual indexing drill fixture',
  category: 'WORKSHOP TOOLS',
  subgroup: 'BENDING & ASSEMBLY JIGS',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description:
    'Bolt-pivot indexing plate with discrete locking positions and a simple carrier mounting pattern.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'indexing',
    'dividing plate',
    'drill press',
    'bolt pivot',
    'rotary fixture',
    'flange',
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
        'Drill/make the metal base and index disc, attach a sacrificial carrier with the four mounting holes, and clamp the base to the drill table. With the machine stopped, loosen the pivot, move to the desired division, insert the locking pin and retighten before drilling. Verify indexing accuracy on a test pattern. Fastener threads/nut retention and carrier details must be selected for the actual build.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Drill/make the metal base and index disc, attach a sacrificial carrier with the four mounting holes, and clamp the base to the drill table. With the machine stopped, loosen the pivot, move to the desired division, insert the locking pin and retighten before drilling. Verify indexing accuracy on a test pattern. Fastener threads/nut retention and carrier details must be selected for the actual build.',
  sources: [],
};
export default part;
