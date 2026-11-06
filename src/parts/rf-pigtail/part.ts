import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import * as assembly from '../../core/assembly/boundary/assembly';
import { conformPrecisionMesh } from '../../core/assembly/precision-mesh';
import { defaults, parameters, catalogFilterFields } from './configurator';
import { article, pieces } from './lib/model';
import product from './product.json';
import presets from './presets.json';
const part: PartDefinition = {
  id: 'rf-pigtail',
  name: 'RF bulkhead pigtail',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'CABLE ENTRY',
  icon: 'circuit',
  preview: 'worker',
  complexity: 'SMA female · AMC · 100 mm',
  product: product as ProductProfile,
  description:
    'Amphenol front-mount SMA female to AMC cable assembly with an internal retaining nut. The installation model represents its bulkhead end and supplied hardware.',
  keywords: [
    'SMA',
    'female',
    'socket',
    'bulkhead',
    'pigtail',
    'RF',
    'antenna',
    'AMC',
    'U.FL',
    'MHF I',
    'Amphenol',
    '095-902-545-100',
    '50 ohm',
  ],
  defaults,
  parameters,
  catalogFilterFields,
  presets: presets as Preset[],
  presetMatchKeys: ['model', 'panelThickness'],
  states: [
    {
      id: 'assembled',
      label: 'Installed hardware',
      description:
        'Bulkhead end with washer and retaining nut positioned behind the selected host panel.',
    },
    {
      id: 'exploded',
      label: 'Hardware inspection',
      description:
        'Separate the O-ring, washer and nut; cable, heatshrink and AMC plug remain omitted.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (p.model !== article.id) errors.push('Choose the supported Amphenol cable assembly.');
    if (
      typeof p.panelThickness !== 'number' ||
      !Number.isFinite(p.panelThickness) ||
      p.panelThickness < 0.8 ||
      p.panelThickness > 2.3
    )
      errors.push('Choose an installation panel thickness between 0.8 and 2.3 mm.');
    for (const key of Object.keys(p))
      if (key !== 'model' && key !== 'panelThickness')
        errors.push(`Unsupported pigtail setting: ${key}.`);
    if (!['assembled', 'exploded'].includes(state))
      errors.push('Choose a supported hardware view.');
    return errors;
  },
  buildGeometry: (p, s) => conformPrecisionMesh(assembly.geometry(pieces(p, s))),
  buildExportGeometry: (p, s) => conformPrecisionMesh(assembly.geometry(pieces(p, s))),
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  assessment(p) {
    return [
      'Purchase one complete 095-902-545-100 kit: 100 ± 3.81 mm, 1.13 mm micro-coax, SMA standard-polarity female bulkhead to right-angle AMC. The supplier specifies 50 ohm and DC–6 GHz; this does not select an antenna band.',
      'Analytical installation geometry only: flexible cable, 12.70 ± 1.27 mm heatshrink and AMC plug are omitted. The cable route, bend allowance and connector engagement require separate checks.',
      'Flange rear seat Z=0; +Z points outside. Front face +8.49 mm REF and connector rear −10.01 mm REF. Flange 11 mm AF. Rear 1/4-36 UNS thread is represented without its helix; the single flat is toward +Y.',
      'Recommended panel opening: diameter 6.60 mm with one flat, total height 6.10 mm. Relative to the connector centre, the flat is at Y=+2.80 mm. Connector D-flat total height is 5.85 mm.',
      `Host panel ${p.panelThickness} mm; approximate inner washer 10.5 mm OD × 0.5 mm and nut 8 mm AF × 1.6 mm. These are installation envelopes, not verified kit dimensions. The recessed compressed O-ring band occupies Z=0..0.4 mm and does not enter the panel.`,
      'A similar 132397 connector drawing specifies an 8 mm nut and 6.35 mm maximum panel, while its current product page lists 2.30 mm. The kit drawing does not identify 132397. This model uses a conservative 2.3 mm installation limit and does not resolve that supplier discrepancy.',
    ];
  },
  notes:
    'Not manufacturer CAD. Main axial references, 11 mm flange and D opening follow the assembly drawing. Undimensioned flange thickness, rear sleeve, nut, washer, seal groove, compressed seal and socket interior are approximate. The kit drawing labels its nut wrench as 1/4 inch, which conflicts with the depicted thread; the 8 mm illustrative nut follows the matching 132397 connector reference without asserting an identical BOM. No precise mating-contact, thread, sealing, torque, retention or panel-thickness qualification is implied. IP67 is a supplier component rating and does not rate the host enclosure. AMC compatibility with Hirose U.FL and I-PEX MHF I follows the manufacturer family documentation. SMA is standard polarity, not RP-SMA. Match the antenna to the actual radio band and connector.',
  sources: [
    {
      label: 'Amphenol 095-902-545-100 product',
      url: 'https://www.amphenolrf.com/en-us/part/095-902-545-100/8896/',
    },
    {
      label: 'Amphenol 095-902-545 cable drawing, revision C',
      url: 'https://www.amphenolrf.com/en-us/assets/file/4068032676/',
    },
    {
      label: 'Similar 132397 connector drawing — supporting reference only',
      url: 'https://www.amphenolrf.com/en-us/assets/file/4065786566/',
    },
    {
      label: '132397 current panel-thickness listing — conflicting source',
      url: 'https://www.amphenolrf.com/en-us/part/132397/829/',
    },
    {
      label: 'Amphenol AMC / U.FL compatibility',
      url: 'https://www.amphenolrf.com/en-us/products/rf-cable-assemblies/amc-cable-assemblies/',
    },
  ],
};
export default part;
