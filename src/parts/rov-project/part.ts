import type { FabricationFile, Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import { defaults, parameters, catalogSelection } from './configurator';
import {
  assembly,
  composition,
  occurrences,
  geometry,
  exportGeometry,
  dimensions,
  exportDimensions,
  python,
  validate,
} from './lib/model';

export { assembly, composition, occurrences, pieces, purchasedLibraries } from './lib/model';

const made = () => assembly.occurrences.filter((item) => item.supply === 'manufactured');
const bought = () => assembly.occurrences.filter((item) => item.supply === 'purchased');
const quote = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const csv = (rows: unknown[][]) => rows.map((row) => row.map(quote).join(',')).join('\n');
const upstream =
  'https://github.com/IWIN-FINS/FinsROV-An-Underwater-Camera-Based-Multi-Robot-Platform';
const pinned = `${upstream}/tree/${assembly.revision}`;

export const sourcePresets: Preset[] = [
  {
    id: 'finsrov',
    name: 'FinsROV · mechanical assembly',
    description:
      'Source-positioned manufactured details and complete purchased equipment units, with separate make and buy lists.',
    parameters: { model: 'finsrov' },
    product: { supply: 'manufactured' },
    catalog: {
      designation: 'FinsROV',
      manufacturer: 'FinsROV contributors',
      sourceName: 'FinsROV original mechanical assembly and manufacturing BOM',
      sourceUrl: assembly.sourceUrl,
      verifiedParameters: ['model'],
      geometryEvidence: {
        kind: 'community-cad',
        summary:
          'Original physical source occurrences, with each fabricated detail and purchased unit explicitly identified.',
        limitations:
          'Unresolved source BOM omissions prevent release. Published geometry does not qualify a newly manufactured vehicle.',
        sourceUrl: assembly.sourceUrl,
        sourceSha256: assembly.sourceSha256,
      },
      attributes: {
        construction: 'Machined aluminium, printed sensor mounts and purchased equipment',
        madeOccurrences: made().length,
        purchasedCadUnits: bought().length,
        printedOccurrences: assembly.occurrences.filter((item) => item.role === 'printed').length,
        license: 'MIT',
      },
      specifications: [
        { label: 'Source revision', value: assembly.revision },
        {
          label: 'Make / buy',
          value: `${made().length} fabricated occurrences / ${bought().length} purchased CAD units`,
        },
        {
          label: 'STL fabrication export',
          value: 'Only the four printed sensor mounts; purchased and machined parts are excluded',
        },
      ],
    },
  },
];

function fabricationFiles(p: Parameters): FabricationFile[] {
  const errors = validate(p, 'assembled');
  if (errors.length) throw new Error(errors.join(' '));
  return [
    {
      id: 'physical-assembly-bom',
      name: 'finsrov-modeled-assembly-bom.csv',
      label: 'Mechanical assembly occurrences · make and buy',
      description:
        'One row per modeled physical occurrence at its source placement. Unmodeled purchase requirements are in the purchase BOM and source review.',
      type: 'text/csv',
      content: csv([
        [
          'Occurrence',
          'Physical item',
          'Make or buy',
          'Library definition',
          'Configuration',
          'Quantity',
          'Manufacturing processes',
          'Material',
          'Purchased designation',
          'Manufacturer',
          'Procurement source',
        ],
        ...assembly.occurrences.map((item) => [
          item.id,
          item.label,
          item.supply,
          item.libraryId,
          JSON.stringify(item.parameters),
          1,
          item.manufacturing?.processes.join('; ') ?? '',
          item.manufacturing?.material ?? '',
          item.procurement?.designation ?? '',
          item.procurement?.manufacturer ?? '',
          item.procurement?.source ?? '',
        ]),
      ]),
    },
    {
      id: 'fabrication-routing',
      name: 'finsrov-MAKE-routing.csv',
      label: 'MAKE · fabricated parts and manufacturing routes',
      description:
        'Only actual made occurrences: printed sensor mounts and machined aluminium details. Contains no servos, thrusters, sensors or enclosure.',
      type: 'text/csv',
      content: csv([
        [
          'Occurrence',
          'Part',
          'Definition',
          'Quantity',
          'Material',
          'Blank',
          'Processes',
          'Requirements',
        ],
        ...made().map((item) => [
          item.id,
          item.label,
          JSON.stringify(item.parameters),
          1,
          item.manufacturing!.material,
          item.manufacturing!.blank,
          item.manufacturing!.processes.join('; '),
          item.manufacturing!.requirements.join(' '),
        ]),
      ]),
    },
    {
      id: 'purchase-bom',
      name: 'finsrov-BUY-procurement.csv',
      label: 'BUY · upstream purchase quantities and units',
      description:
        'Uses purchase units from the audited upstream BOM. A cabin kit can contain multiple CAD units; thruster pairs are not counted as individual thrusters.',
      type: 'text/csv',
      content: csv([
        [
          'BOM item',
          'Purchased item',
          'Order quantity',
          'Purchase unit',
          'Manufacturer',
          'Designation',
          'Source',
          'Modeled CAD units',
          'Notes',
        ],
        ...assembly.bom.procurement.map((item) => [
          item.id,
          item.name,
          item.quantity === null ? 'To specify' : item.quantity,
          item.unit,
          item.manufacturer,
          item.designation,
          item.source,
          item.cadUnitCount,
          item.notes,
        ]),
      ]),
    },
    {
      id: 'assembly-source-and-review',
      name: 'finsrov-source-assembly-and-review.json',
      label: 'Source assembly, placements and unresolved BOM items',
      description:
        'Original assembly provenance, real make/buy occurrences, procurement BOM and source discrepancies. Required review before release.',
      type: 'application/json',
      content: JSON.stringify(assembly, null, 2),
    },
  ];
}

const part: PartDefinition = {
  id: 'rov-project',
  name: 'FinsROV mechanical assembly',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'UNDERWATER ROVS',
  icon: 'camera',
  product: profile as ProductProfile,
  description:
    'A source-positioned mechanical assembly with explicit printed parts, machined details and purchased equipment. Servos and thrusters remain complete bought units.',
  complexity: 'Make / buy assembly',
  preview: 'worker',
  keywords: [
    'ROV',
    'underwater',
    'FinsROV',
    'submarine',
    'manufacturing',
    'assembly',
    'printed',
    'milling',
    'turning',
    'drilling',
    'servo',
    'thruster',
  ],
  validationNotice:
    'Make and buy are separated. Source BOM omissions remain unresolved; inspect the assembly review before fabrication.',
  defaults,
  parameters,
  catalogSelection,
  catalogSelectionOnly: true,
  presets: sourcePresets,
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'license',
      label: 'Hardware license',
      group: 'Source',
      type: 'select',
      options: [{ value: 'MIT', label: 'MIT' }],
    },
    {
      key: 'construction',
      label: 'Construction',
      group: 'Assembly',
      type: 'select',
      options: [
        {
          value: 'Machined aluminium, printed sensor mounts and purchased equipment',
          label: 'Machined aluminium, printed sensor mounts and purchased equipment',
        },
      ],
    },
    {
      key: 'madeOccurrences',
      label: 'Fabricated occurrences',
      group: 'Assembly',
      type: 'number',
      unit: 'parts',
    },
    {
      key: 'purchasedCadUnits',
      label: 'Purchased CAD units',
      group: 'Assembly',
      type: 'number',
      unit: 'units',
    },
    {
      key: 'printedOccurrences',
      label: 'Printed occurrences',
      group: 'Fabrication',
      type: 'number',
      unit: 'parts',
    },
  ],
  composition,
  states: [
    {
      id: 'assembled',
      label: 'Mechanical assembly',
      description:
        'Source placements. Green: printed parts. Silver: machined parts. Purchased units retain their library appearance.',
    },
    {
      id: 'manufactured',
      label: 'Made parts',
      description:
        'Only the fabricated occurrences at their actual assembly placements. STL still exports the printed mounts only; use FreeCAD/STEP for metal details.',
    },
    {
      id: 'printed',
      label: 'Printed parts',
      description:
        'Only the source pressure-sensor mounts. Servos, thrusters, enclosure and electronics are never included.',
    },
    {
      id: 'machined',
      label: 'Machined parts',
      description:
        'Only the source aluminium details, with their original assembly placements and machining routes. Use FreeCAD/STEP; this view refuses STL printing export.',
    },
    {
      id: 'purchased',
      label: 'Purchased equipment',
      description:
        'Opaque bought units for installation and procurement. This view has no STL fabrication export.',
    },
    {
      id: 'exploded',
      label: 'Inspection separation',
      description:
        'Physical source units separated for inspection. Their BOM, make/buy identity and assembly placements remain unchanged.',
    },
  ],
  validate,
  buildGeometry: geometry,
  buildExportGeometry: exportGeometry,
  dimensions,
  exportDimensions,
  python,
  fabricationFiles,
  assessment() {
    return [
      `${assembly.name}: ${assembly.occurrences.length} modeled physical occurrences: ${made().length} fabricated and ${bought().length} bought CAD units.`,
      'Green means print; silver means machine; blue means buy. A purchased thruster or servo is one equipment unit, including its source-model internal solids.',
      'STL contains only the four printed sensor mounts, laid out in their original making-file orientation. Servos, thrusters, cabin and electronics are bought; the 22 metal occurrences require machining. Use FreeCAD/STEP for the manufactured assembly and metal details.',
      'Purchase quantities come from the upstream BOM, not the number of CAD solids. The enclosure kit and paired-thruster order units are preserved in the BUY download.',
      ...assembly.issues.map((issue) => `Unresolved source item: ${issue}`),
      'The physical source assembly does not include every required electrical, sealing or fastening item. Resolve the source review and upstream build instructions before release.',
    ];
  },
  notes:
    'This is a make/buy mechanical assembly. Purchased equipment internals are not fabrication parts. Original placements and making interfaces are retained. Source BOM discrepancies remain explicit design-review issues. STL printing exports contain only the four printed sensor mounts. Purchased and machined-only views refuse STL export. FreeCAD/STEP retains the physical manufactured and purchased assembly.',
  sources: [
    { label: 'Original FinsROV assembly', url: assembly.sourceUrl },
    { label: 'Manufacturing details and BOM', url: `${pinned}/Structure/En` },
    { label: 'Build and wiring instructions', url: `${pinned}/Making_Instructions` },
    { label: 'Control software', url: `${pinned}/Code` },
    { label: 'Upstream hardware license', url: `${upstream}/blob/${assembly.revision}/LICENSE` },
  ],
};
export default part;
