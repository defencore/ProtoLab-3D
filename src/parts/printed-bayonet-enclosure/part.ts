import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection } from './configurator';
import { layout, components, pieces } from './lib/model';
import profile from './product.json';
import presets from './presets.json';
const libraries = [detail];
const part: PartDefinition = {
  id: 'printed-bayonet-enclosure',
  name: 'Printed bayonet enclosure',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  complexity: 'Empty enclosure template',
  preview: 'worker',
  description:
    'Round empty enclosure with integral lugs, internal L grooves and a short-turn removable lid.',
  keywords: [
    '3D printing',
    'enclosure joint',
    'interlock',
    'bayonet',
    'quarter turn',
    'twist lock',
    'lid',
    'housing',
    'groove',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['diameter', 'height', 'lugs', 'turnAngle'],
  product: profile as ProductProfile,
  states: [
    {
      id: 'assembled',
      label: 'Locked',
      description:
        'Nominal locked position near the closed channel ends, with tangential running clearance; reverse rotation remains possible.',
    },
    {
      id: 'unlocked',
      label: 'Entry aligned',
      description: 'Lugs aligned with open axial entry channels, ready for lifting the lid.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Entry-aligned cap withdrawn above the neck; local geometry and physical quantities unchanged.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description: 'Body floor down and lid outer roof down, separated by 8 mm on Z=0.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'unlocked', 'exploded', 'print'].includes(state))
      errors.push('Choose an implemented enclosure state.');
    if (
      parameters.some(
        (f) =>
          typeof p[f.key] !== 'number' ||
          !Number.isFinite(p[f.key]) ||
          Number(p[f.key]) < f.min! ||
          Number(p[f.key]) > f.max!,
      )
    )
      return [
        ...errors,
        'Enclosure parameters must be finite numbers within their supported bounds.',
      ];
    const d = layout(p);
    if (!Number.isInteger(d.count)) errors.push('Lug count must be a whole number.');
    if (d.boreR < 8)
      errors.push('Diameter must leave at least 8 mm clear cavity radius inside the neck.');
    if (d.neckZ < d.floor + d.w)
      errors.push('The lower body must retain clear cavity height below the neck.');
    if (d.lugRelativeZ - d.ac < d.w / 2)
      errors.push(
        'The groove must leave at least half a wall thickness of axial capture below the lug.',
      );
    if (d.lugZ + d.lugT + d.ac > d.H - d.w / 2)
      errors.push('Increase neck height to retain a continuous rim above the bayonet lugs.');
    if (d.turn + d.span + 2 * d.angleGap + 10 >= 360 / d.count)
      errors.push(
        'Bayonet channels must leave a continuous bridge of at least 10 degrees between neighboring channels.',
      );
    if (d.projection <= d.c + 0.5)
      errors.push(
        'Lug projection must exceed radial clearance by more than 0.5 mm for positive capture.',
      );
    return errors;
  },
  composition: (p) => ({
    components: components(p),
    issues: [
      'Empty authored enclosure template: lay out actual electronics, plugs, cables, mounts and thermal paths before adapting the shell.',
      'The bayonet has positive axial capture and angular end stops, but no detent, seal or guaranteed resistance to reverse rotation. Qualify actual material, loads, clearances and service cycles.',
    ],
  }),
  buildGeometry: (p, s) => componentGeometry(libraries, pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, pieces(p, s), true),
  python: (p, s) => componentPython(libraries, pieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, pieces(p, s)),
  assessment: (p) => {
    const d = layout(p);
    return [
      `Neck bore ${(2 * d.boreR).toFixed(1)} mm; cap outside diameter ${(2 * d.capR).toFixed(1)} mm. ${d.count} lugs, ${d.turn}° nominal locking rotation; hard stop at approximately ${(d.turn + d.angleGap).toFixed(2)}°. Radial overlap beyond the running bore ${(d.projection - d.c).toFixed(2)} mm.`,
      'Align entries, lower the cap, then rotate in +Z direction to the channel ends. Reverse rotation before lifting. A separate anti-rotation feature is required if accidental unlocking must be prevented.',
    ];
  },
  notes:
    'Authored empty can and lid, without electronics or a sealing claim. Circular grooves retain true native arcs. Print the cap roof down and review internal overhangs/support removal. Locked and entry-aligned views are inspection poses; installed project composition remains locked.',
  sources: [
    {
      label: 'Protolabs Network enclosure design guidance',
      url: 'https://www.hubs.com/knowledge-base/enclosure-design-3d-printing-step-step-guide/',
    },
  ],
};
export default part;
