import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters, catalogSelection, catalogFilterFields } from './configurator';
import { models, selected, geometry, dimensions, python } from './lib/model';
import presets from './presets.json';
import profile from './product.json';
const part: PartDefinition = {
  id: 'signal-connector',
  name: 'PCB connector',
  category: 'CONNECTORS & INTERFACES',
  subgroup: 'PCB CONNECTORS',
  icon: 'circuit',
  product: profile as ProductProfile,
  preview: 'worker',
  description:
    'USB sockets, DC barrel jacks, audio jacks, RF connectors, JST headers, pin strips, IDC and DE-9 connectors, plus authored nominal XH-style 2.54 mm balance headers.',
  complexity: 'Fixed connector catalog',
  keywords: [
    'USB',
    'USB-C',
    'USB-A',
    'Micro USB',
    'Mini USB',
    'JST',
    'XH',
    'XH2.54',
    'balance connector',
    'polarized',
    'PH',
    'SMA',
    'MMCX',
    'U.FL',
    'DC5521',
    'DC5525',
    'barrel',
    'audio',
    'TRS',
    '3.5 mm',
    'pin header',
    'socket',
    'Dupont',
    'IDC',
    'ribbon cable',
    'DE-9',
    'DB9',
    'connector',
    'PCB',
  ],
  defaults,
  parameters,
  catalogSelection,
  catalogFilterFields,
  catalogSelectionOnly: true,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Connector in its declared PCB reference frame, with source quality identified per model.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model)) errors.push('Choose a supported connector model.');
    if (Object.keys(p).some((key) => key !== 'model'))
      errors.push('Connector dimensions are fixed; choose another model.');
    if (state !== 'assembled') errors.push('Choose the assembly view.');
    return errors;
  },
  buildGeometry: geometry,
  buildExportGeometry: geometry,
  dimensions,
  python,
  assessment(p) {
    const m = selected(p),
      authored = Boolean(m.native.sourceKind);
    return [
      m.name,
      m.scope,
      m.evidence,
      `${authored ? 'Authored nominal envelope' : 'Source envelope'}: ${m.native.dimensions.map((v) => v.toFixed(2)).join(' × ')} mm; ${m.native.sourceSolids} ${authored ? 'authored' : 'retained source'} closed solids.`,
      m.native.origin,
      'Keep the mating opening accessible and leave space for the plug body and cable bend. No mating plug or service clearance volume is included.',
      authored
        ? 'White housing and metallic contact colors follow the supplied appearance reference. Shell dimensions, retention force and the delivered matched pair remain unverified.'
        : `Original source colors retained for ${m.colors.filter((c) => c.kind === 'source-step').length} of ${m.colors.length} source solids; remaining colors are illustrative. Colors do not establish the purchased material or finish.`,
      authored
        ? 'The nominal asymmetric guide pair blocks reversed insertion in this authored geometry. Verify the actual purchased pair, pin numbering and polarity before connecting it.'
        : 'Contacts and housings are fused in many community STEP files. Source solid count is not a manufacturing bill of materials; no artificial exploded view is supplied.',
    ];
  },
  fabricationFiles(p) {
    const m = selected(p);
    return [
      {
        id: 'source-reference',
        label: 'Connector source and mounting reference',
        description: 'Pinned source reference, PCB origin, source quality and model limitations',
        name: m.id + '-source-reference.json',
        type: 'application/json',
        content: JSON.stringify(
          {
            model: m.name,
            sourceUrl: m.sourceUrl,
            sourceSha256: m.sourceSha256,
            sourceFile: m.file,
            sourceKind: m.native.sourceKind ?? 'KiCad 9.0.1 community 3D reference',
            reference: m,
            components: m.native.components.map(
              ({ id, sourceSolid, bounds, volume, brepSha256 }) => ({
                id,
                sourceSolid,
                bounds,
                volume,
                brepSha256,
              }),
            ),
            license: m.native.sourceKind
              ? 'Authored ProtoLab geometry from user-supplied appearance references; supplier identity and interchangeability are not established.'
              : 'CC-BY-SA-4.0 with KiCad library exception; see package attribution',
          },
          (key, value) =>
            ['brep', 'vertices', 'triangles', 'native'].includes(key) ? undefined : value,
          2,
        ),
      },
    ];
  },
  validationNotice:
    'Model source quality is declared per selection. Confirm the ordered part, mounting interface and matching plug before fabrication.',
  notes:
    'Cited KiCad 9.0.1 STEP surfaces and source coordinates are retained. Generic pin strips, IDC and DE-9 do not establish a supplier order code. Nominal XH-style 2.54 mm balance headers are authored from user photos and the requested pitch; other dimensions and the paired cable housing are estimates. They are not original JST 2.50 mm or manufacturer CAD. Complete uniform source colors are retained where available; remaining colors are illustrative. Current, voltage, RF impedance, USB speed and interchangeability are not inferred from geometry.',
  sources: [
    {
      label: 'KiCad · connector 3D libraries',
      url: 'https://gitlab.com/kicad/libraries/kicad-packages3D/-/tree/9.0.1',
    },
    { label: 'KiCad · library license', url: 'https://www.kicad.org/libraries/license/' },
    {
      label: 'Generic XH-style appearance reference · authored model scope',
      url: 'https://www.hanbodianzi.com/shows/103/41.html',
    },
  ],
};
export default part;
