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
  id: 'router-template',
  name: 'Router slot and pocket template',
  category: 'WORKSHOP TOOLS',
  subgroup: 'ROUTING & PROFILE TEMPLATES',
  icon: 'bracket',
  complexity: 'Workshop fixture prototype',
  preview: 'worker',
  description:
    'Guide-bush compensated slots, rounded pockets and circular openings with clamping borders.',
  keywords: [
    'workshop',
    'jig',
    'template',
    'fixture',
    'router',
    'mortise',
    'slot',
    'pocket',
    'guide bush',
    'template offset',
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
        'Use a centered router guide bush, not a bearing-guided cutter. The opening adds guide-bush OD minus cutter OD to each finished dimension. Verify the combination on scrap, bush projection and depth adjustment before cutting. Keep the template securely clamped and ensure the router sole remains supported; large openings may require an auxiliary bridge/sub-base.',
        'Select actual material, tool dimensions, bushing/pin retention, clamp method, drilling depth and working load. Verify fits and accuracy on scrap before repeating the operation.',
      ],
    };
  },
  buildGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, configured(pieces(p), s), true),
  python: (p, s) => componentPython(libraries, configured(pieces(p), s)),
  dimensions: (p, s) => componentDimensions(libraries, configured(pieces(p), s)),
  notes:
    'Use a centered router guide bush, not a bearing-guided cutter. The opening adds guide-bush OD minus cutter OD to each finished dimension. Verify the combination on scrap, bush projection and depth adjustment before cutting. Keep the template securely clamped and ensure the router sole remains supported; large openings may require an auxiliary bridge/sub-base.',
  sources: [
    {
      label: 'Trend guide bush application',
      url: 'https://www.trend-uk.com/gb18-guide-bush-18mm-diameter',
    },
  ],
};
export default part;
