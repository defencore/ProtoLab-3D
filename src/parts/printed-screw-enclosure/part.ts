import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentDimensions,
  componentGeometry,
  componentPython,
} from '../../core/assembly/detail-instances';
import { defaults, parameters, catalogSelection, updateParameters } from './configurator';
import { composition, layout, libraries, pieces } from './lib/model';
import product from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'printed-screw-enclosure',
  name: 'Printed enclosure with captive nuts',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  complexity: 'Printable empty enclosure template',
  description:
    'Empty rectangular case with four side-loaded nut traps and recessed socket or countersunk M3 lid screws.',
  keywords: [
    '3D printing',
    'enclosure joint',
    'screw joint',
    'screw interlock',
    'captive nut',
    'nut trap',
    'countersunk',
    'counterbore',
    'recessed screw',
    'case',
    'lid',
  ],
  product: product as ProductProfile,
  parameters,
  defaults,
  catalogSelection,
  updateParameters,
  presets: presets as Preset[],
  presetMatchKeys: ['width', 'depth', 'height', 'headStyle'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Closed case with four sourced screws and four side-loaded captive nuts.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Inspection separation only; canonical installed components stay unchanged.',
    },
    {
      id: 'print',
      label: 'For 3D printing',
      description:
        'Only the body and lid, flat surfaces on Z=0 and separated by 8 mm. Metal hardware is excluded.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'exploded', 'print'].includes(state))
      errors.push('Choose an implemented model state.');
    if (!['socket', 'countersunk'].includes(String(p.headStyle)))
      errors.push('Choose a sourced screw head execution.');
    const d = layout(p);
    if (d.width - 2 * d.inset <= d.bossWidth + 8 || d.depth - 2 * d.inset <= d.bossWidth + 8)
      errors.push('Leave at least 8 mm of open cavity between opposing corner bosses.');
    if (d.bossWidth / 2 - d.pocketAF / Math.sqrt(3) < d.wall)
      errors.push('Bosses must leave at least one wall thickness beyond the hex pocket corners.');
    if (d.roof < d.wall - 1e-8)
      errors.push(
        'The nut pocket roof must retain at least the selected wall thickness. Reduce lid thickness or choose a compatible sourced screw seat.',
      );
    if (d.nutPocketBottom < 2 * d.wall - 1e-8)
      errors.push('The nut pocket must leave at least one wall thickness above the body floor.');
    if (d.lidSeatWeb < d.wall - 1e-8)
      errors.push(
        'The head seat must leave at least the selected wall thickness above the lid underside. Increase lid thickness or reduce recess.',
      );
    if (d.pocketAF >= (2 * d.nutAF) / Math.sqrt(3))
      errors.push('Nut pocket clearance must retain hex corner overlap to resist rotation.');
    return errors;
  },
  composition,
  buildGeometry: (p, s) => componentGeometry(libraries, pieces(p, s)),
  buildExportGeometry: (p, s) => componentGeometry(libraries, pieces(p, s, true), true),
  python: (p, s) => componentPython(libraries, pieces(p, s)),
  dimensions: (p, s) => componentDimensions(libraries, pieces(p, s)),
  assessment(p) {
    const d = layout(p);
    return [
      `Four ${d.selected.catalog!.standard} M3 × 12 screws and DIN 934 M3 nuts. Nut engagement ${d.nutHeight.toFixed(1)} mm; nominal screw projection below nut ${(2 * d.pitch).toFixed(1)} mm.`,
      `Nut roof ${d.roof.toFixed(2)} mm; head-seat residual lid web ${d.lidSeatWeb.toFixed(2)} mm. Insert nuts horizontally from the empty cavity before fitting the lid.`,
      'The lid is removable; no seal or IP rating is implemented. Fit actual equipment, qualify printing, torque and long-term polymer creep before use.',
    ];
  },
  notes:
    'Authored empty enclosure template; actual sourced screw and nut dimensions remain fixed. Print-state STL contains only the two printed parts. Metal hardware belongs to the canonical assembly, not the printing file.',
  sources: [
    {
      label: 'Gvyntok DIN 912 M3 × 12',
      url: 'https://gvyntok.com/shop/bolty-i-vinty/vint-tsilindricheskij-din-912-kl-pr-8-8/vint-czilindricheskij-din-912-kl-pr-8-8-m3h12/',
    },
    {
      label: 'Gvyntok DIN 7991 M3 × 12',
      url: 'https://gvyntok.com/shop/bolty-i-vinty/vint-potajnoj-din-7991/vint-potajnoj-din-7991-m3h12/',
    },
    {
      label: 'Gvyntok DIN 934 M3 nut',
      url: 'https://gvyntok.com/shop/gajki/gajka-sh-g-kl-pr-6-0-din-934/gajka-sh-g-kl-pr-6-0-din-934-m3/',
    },
  ],
};
export default part;
