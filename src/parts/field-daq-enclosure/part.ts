import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {
  componentGeometry,
  componentPython,
  componentDimensions,
} from '../../core/assembly/detail-instances';
import { defaults, parameters } from './configurator';
import { configuredPieces, composition, libraries, printIds } from './lib/model';
import profile from './product.json';
import presets from './presets.json';

const states = [
  {
    id: 'assembled',
    label: 'Assembly',
    description:
      'Closed field DAQ enclosure, with optional PCB installation references and full SP16-5 / SP20-3/4 library connectors.',
  },
  {
    id: 'open',
    label: 'Open lid',
    description:
      'Upper lid removed; the central bridge and its four pads remain locked in place, mechanically capturing both inner PCB edges.',
  },
  {
    id: 'board-service',
    label: 'PCB service',
    description:
      'Access after releasing the central bridge: lift its leaf 0.9 mm, slide the key 3 mm toward −Y and lift it, then withdraw one PCB 9.5 mm toward the central gap.',
  },
  {
    id: 'exploded',
    label: 'Exploded',
    description:
      'Inspect the lids, wall, sensor cassette, removable central bridge and soft details. The bridge and its four pads separate from the lid.',
  },
  {
    id: 'print-layout',
    label: 'Print layout',
    description:
      'Separate PETG parts and TPU parts in their intended printing poses. Split this inspection layout into separate build plates.',
  },
  {
    id: 'base',
    label: 'Bottom lid',
    description:
      'Bottom lid with elevated PCB supports, outer-edge envelopes and closure nut seats.',
  },
  {
    id: 'wall',
    label: 'Perimeter wall',
    description: 'Separate perimeter wall with fixed SP16 aperture and keyed cassette opening.',
  },
  {
    id: 'lid',
    label: 'Top lid',
    description:
      'Upper lid with a flat label zone, engraved outline and a positive bridge-unlocking backup stop.',
  },
  {
    id: 'panel',
    label: 'Sensor cassette',
    description: 'Selected removable SP20 cassette or blank panel.',
  },
  {
    id: 'retainer',
    label: 'Central PCB bridge',
    description:
      'Separate PETG bridge with two groove stations, base hooks, release leaf and a positive lid backup stop. Print with the groove roofs toward the bed.',
  },
  {
    id: 'gasket',
    label: 'TPU gasket',
    description:
      'One lid gasket in its free printing form. Print the required pair separately from PETG.',
  },
  {
    id: 'fit-coupon',
    label: 'Fit coupon',
    description:
      'Small fit sample for PCB retention, connector apertures and side-loaded nut capture. Check thread start only; its blind tip well is not a full tightening fixture.',
  },
  {
    id: 'retention-coupon',
    label: 'Central groove test base',
    description:
      '34 × 104 mm test base with production bayonet seats, catch, PCB-edge ledges and broad open triangular inner-corner pockets. Use the production bridge and bare PCB strips to check centering, groove capture, lock and release before printing the full base.',
  },
];

const physicalPieces = (p: Parameters, state: string) =>
  configuredPieces(p, state).filter((piece) => piece.component.supply !== 'reference');

const part: PartDefinition = {
  id: 'field-daq-enclosure',
  name: 'Field DAQ enclosure · R3',
  category: 'ENCLOSURES & DEVICES',
  subgroup: 'GENERAL-PURPOSE ENCLOSURES',
  icon: 'box',
  preview: 'worker',
  complexity: 'PETG · two PCBs · SP16 / SP20',
  product: profile as ProductProfile,
  description:
    'Revision 3 field DAQ fit-check prototype for 60 × 80 and 120 × 80 mm perfboards, with outer triangular board envelopes, a removable bridge forming positive inner-edge grooves, two gasketed lid interfaces and an interchangeable two-, three- or four-position SP20 cassette on the narrow end opposite SP16.',
  keywords: [
    'DAQ',
    'field',
    'sensor',
    'pressure',
    'load cell',
    'RS485',
    '14–20 V',
    'KY00012',
    'PY-8x12CM',
    'SP16',
    'SP20',
    'PETG',
    'TPU',
    'perfboard',
    'enclosure',
    'removable panel',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states,
  presetMatchKeys: ['bodyWidth', 'sensorCount', 'screwLength'],
  identityParameters(p) {
    const { showReferences: _showReferences, componentHeight: _componentHeight, ...physical } = p;
    return physical;
  },
  validate(p, state) {
    const errors: string[] = [];
    if (!states.some((item) => item.id === state))
      errors.push('Choose a supported assembly, detail or printing view.');
    if (!['2', '3', '4', 'blank'].includes(String(p.sensorCount)))
      errors.push('Choose two, three, four or no SP20 apertures.');
    if (!['25', '30'].includes(String(p.screwLength)))
      errors.push('Choose M3 × 25 or M3 × 30 closure hardware.');
    if (p.sensorCount === '4' && Number(p.bodyWidth) < 164)
      errors.push(
        'Four SP20 sockets need a body width of at least 164 mm. Increase the width before selecting four sockets.',
      );
    for (const [key, label, min, max] of [
      ['bodyWidth', 'Body width', 116, 180],
      ['boardThickness', 'PCB thickness', 1.2, 2],
      ['fitClearance', 'Sliding fit clearance', 0.15, 0.5],
      ['sp16Hole', 'SP16 aperture', 15, 19],
      ['sp20Hole', 'SP20 aperture', 19, 23],
      ['componentHeight', 'Component height', 5, 25],
    ] as const) {
      const value = p[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        errors.push(`${label} must be between ${min} and ${max} mm.`);
    }
    if (typeof p.showReferences !== 'boolean')
      errors.push('Choose whether to show installation references.');
    for (const key of Object.keys(p))
      if (!(key in defaults)) errors.push(`Unsupported enclosure parameter: ${key}.`);
    return errors;
  },
  composition,
  buildGeometry: (p, state) => componentGeometry(libraries, configuredPieces(p, state)),
  buildExportGeometry: (p, state) => componentGeometry(libraries, physicalPieces(p, state), true),
  python: (p, state) => componentPython(libraries, physicalPieces(p, state)),
  dimensions: (p, state) => componentDimensions(libraries, configuredPieces(p, state)),
  exportDimensions: (p, state) => componentDimensions(libraries, physicalPieces(p, state)),
  assessment(p) {
    return [
      `R3 core 220 × ${p.bodyWidth} × 46 mm with a 222.4 × ${(Number(p.bodyWidth) + 2.4).toFixed(1)} mm overhanging upper lid and a reinforced underside box beam. Steel washers and socket screw heads extend the assembly to 48.3 mm. A 0.6 mm-wide engraved outline marks the flat 96 × 44 mm label zone.`,
      `Two adjacent PCB outlines: KY00012 60 × 80 mm and PY 120 × 80 mm. Bare board thickness ${p.boardThickness} mm; underside at Z8 mm; reference component height ${p.componentHeight} mm above the PCB. The user confirmed two clear 4 × 10 mm inner-edge lands per board at Y±24. Four 2.8 × 6 × 1.2 mm bridge pads target 20% compression; confirm substrate thickness, solder projections and the actual board service path.`,
      'Seat both boards in the outer corner pockets first. Hold the leaf 0.9 mm lifted while lowering the central bridge at its entry and sliding it +Y3 mm, then release the leaf into its unloaded locked position. Base ledges and bridge roofs form positive inner-edge grooves; lid pressure and pad friction are not the retention. For service, remove the lid, lift the leaf 0.9 mm, slide the bridge −Y3 mm and lift it out before moving one board inward 9.5 mm.',
      `${p.sensorCount === 'blank' ? 'Blank interchangeable sensor cassette' : `${p.sensorCount} SP20 apertures at ${p.sensorCount === '3' && Number(p.bodyWidth) < 124 ? 32 : 36} mm pitch`} on the X+110 narrow end, opposite fixed SP16 at X−110, Y0, Z25. Both use two opposing flats: SP16 Ø${p.sp16Hole} / ${(Number(p.sp16Hole) - 1.2).toFixed(1)} mm flat-to-flat; SP20 Ø${p.sp20Hole} / ${(Number(p.sp20Hole) - 1).toFixed(1)} mm flat-to-flat. Full library references show the SP16-5 female panel connector and SP20-4 / SP20-3 female panel sockets.`,
      'Keep at least 20 mm inward from both X end walls clear of tall components for connector bodies, solder tails and insulated wire bends. Component reference zones are PSU X−84…−38 and MCU X−20…84, both Y±32. Leave service space for the cassette.',
      `The sensor cassette is ${Number(p.bodyWidth) - 16} mm wide. Two-, three- and blank cassettes interchange within one body width; four SP20 sockets require at least 164 mm. Width stays at the selected value.`,
      `Four M3 × ${p.screwLength} closure screws secure both lids and the keyed wall. Use the matching side-loaded M3 nut traps with a base-owned 3 mm bearing roof, plus four steel flat washers 3.2 × 7 × 0.5 mm. The washers seat on PETG hard annuli, while the separate TPU seals sit underneath. Check engagement and hard-stop contact before tightening.`,
      'R3 perimeter gaskets are 1.35 mm wide × 1.2 mm high in 2.0 × 0.96 mm glands, targeting 20% compression and approximately 84.4% volume fill. Cassette stops limit inward travel to 0.1 mm, targeting 20–26.7% U-seal compression. Four under-washer TPU seals have 4.84 mm free OD / 2.8 mm free ID and compress from 0.8 to 0.6 mm; their 0.1 mm radial shaft interference gives approximately 84.3% nominal available-volume fill. Qualify actual threaded-shaft sealing and all junctions physically.',
      `${printIds.length} printed enclosure occurrences: five PETG parts and eleven TPU gaskets, pads and under-washer seals; add four screws, four nuts and four steel washers for 28 physical occurrences. Print PETG separately from TPU; fit the small coupon first. Ordinary flexible TPU should use the external spool path unless explicitly approved for AMS.`,
      'The shell has no vents, switches or indication windows. Apply the wiring legend as one weather-resistant label: pressure / load / RS485 + 14–20 V, according to the actual pinout.',
      'R3 is a fit-check prototype for wet ground, dirt, rain, snow and meltwater. No IP or impact rating is established. Qualify ingress, cold handling, impacts and repeated closure on physical prints before installing electronics.',
    ];
  },
  notes:
    'Revision 3 fit-check prototype for wet ground, dirt, rain, snow and meltwater. R3 replaces the withdrawn earlier enclosure files, including R2; do not mix revisions. A single removable bridge closes the inner PCB grooves after board installation. Hold its leaf 0.9 mm up while lowering it at its entry and sliding +Y3 mm, then release the leaf to lock; lift the outside-board release leaf 0.9 mm, slide −Y3 mm and lift to release. The lid rear post supplies a positive reverse-stroke backup. Retention uses rigid groove geometry, not lid pressure or pad friction. TRIZ segmentation, local quality, preliminary action, dynamics and intermediary principles guided the mechanism. Side-loaded nuts bear against a base-owned 3 mm roof. Steel M3 washers seat on PETG hard annuli, isolating structural closure preload from the smaller soft seals. The upper cover retains the 1.2 mm core overhang and underside box beam. Perimeter gland volume fill is approximately 84.4%; cassette hard stops limit inward travel to 0.1 mm. Connectors face opposite narrow ends: SP16 at X−110 and the sensor cassette at X+110. The 116 mm-wide body accepts two or three SP20 sockets; four requires at least 164 mm body width. Cassettes interchange only at the same body width; changing the socket count never changes the width automatically. The installation view uses full library SP16-5 and SP20-3/4 female panel connectors. Supplier mounting drawings specify two opposing flats: SP16 Ø16.5 / 15.3 mm flat-to-flat and SP20 Ø20.5 / 19.5 mm flat-to-flat. These are source-dimension reconstructions, not manufacturer CAD; undimensioned contact positions and small moulded details remain illustrative. Connector and PCB references are omitted from manufactured composition and case-only fabrication exports; the separate installation document retains the connector library identities. Clear PCB contact lands were confirmed by the user. Substrate thickness and component height remain adjustable; only those clear margins may contact the envelopes and bridge pads. The bare-substrate CAD route does not establish a universal allowance for protruding solder or leads; test the populated board motion. The 96 × 44 mm label zone is flat inside an engraved outline. Fit the four bridge TPU pads with compatible adhesive if needed; keep any gasket tack outside the active sealing face. Print and inspect the fit coupon, then qualify the lid key fit, cassette fit, hardware stack, wire routing and seal continuity. Keep the selected four M3 screws matched to their base nut seats. TPU seal compression is a nominal design target. Four screws on this footprint require checking lid flatness and gasket contact around the entire perimeter. Physical rain, wet-ground, meltwater, cold handling and impact tests remain required. No IP or impact qualification is implied.',
  sources: [
    { label: 'TRIZ inventive principles / design method', url: 'https://triz.org/principles/' },
    {
      label: 'SP16-5 supplier housing / two-flat mounting drawing',
      url: 'https://klmaster.com/files/goods/182/gallery/germetichnyy_razem_sp16_5_pin_1.jpg',
    },
    {
      label: 'SP20 supplier housing / two-flat mounting drawing',
      url: 'https://klmaster.com/files/ckeditor/580/5238f7e9a0fea65cb4a62e36c2631fb1.jpg',
    },
    {
      label: 'Bambu Lab AMS 2 Pro manual / TPU for AMS compatibility',
      url: 'https://csm.bblcdn.com/hub/default/5802624bcf8644fe809a6541818d884f.pdf',
    },
  ],
};

export default part;
