import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { defaults, parameters, catalogSelection } from './configurator';
import { models, selected, selectedComponents, geometry, python, dimensions } from './lib/model';
import profile from './product.json';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'rover-chassis',
  name: 'Robot chassis',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'GROUND VEHICLES',
  icon: 'wheel',
  product: profile as ProductProfile,
  description:
    'Original supplier CAD for Pololu Romi, DFRobot Pirate 4WD and Waveshare UGV Rover, with actual equipment decks, drive geometry and factory mounting features.',
  complexity: 'Fixed manufacturer CAD',
  preview: 'worker',
  keywords: [
    'rover',
    'chassis',
    'robot',
    'UGV',
    'Pololu',
    'Romi',
    'DFRobot',
    'Pirate',
    'ROB0003',
    'Waveshare',
    '4WD',
    '2WD',
    'six wheel',
    'payload',
    'battery',
    'equipment',
    'mounting',
  ],
  validationNotice:
    'Original supplier geometry. Match the CAD revision and kit contents before ordering or fitting equipment.',
  defaults,
  parameters,
  catalogSelection,
  catalogSelectionOnly: true,
  presets: presets as Preset[],
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'manufacturer',
      group: 'Supplier',
      label: 'Manufacturer',
      type: 'select',
      options: [...new Set(models.map((m) => m.manufacturer))].map((value) => ({
        value,
        label: value,
      })),
    },
    {
      key: 'drive',
      group: 'Supplier',
      label: 'Drive',
      type: 'select',
      options: [...new Set(models.map((m) => m.drive))].map((value) => ({ value, label: value })),
    },
    { group: 'Source envelope', key: 'length', label: 'CAD length', type: 'number', unit: 'mm' },
    { group: 'Source envelope', key: 'width', label: 'CAD width', type: 'number', unit: 'mm' },
    { group: 'Source envelope', key: 'height', label: 'CAD height', type: 'number', unit: 'mm' },
  ],
  states: [
    {
      id: 'assembled',
      label: 'Supplier assembly',
      description:
        'All geometry actually present in the original source CAD, with its original relative placements.',
    },
    {
      id: 'frame',
      label: 'Frame and mounting surfaces',
      description:
        'Original structural plates, body, deck supports and expansion mounting features; running gear and equipment hidden for access inspection.',
    },
    {
      id: 'drive',
      label: 'Wheels and drive',
      description:
        'Source wheels, tyres and drive parts. Source omissions are stated in the model scope.',
    },
    {
      id: 'exploded',
      label: 'Inspection separation',
      description:
        'Rigid display offsets by source role. No supplier geometry or working position is redesigned.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!models.some((m) => m.id === p.model))
      errors.push('Choose a supported chassis model.');
    for (const key of Object.keys(p))
      if (!['model', 'explodedGap'].includes(key))
        errors.push(`Supplier geometry is fixed; unsupported parameter: ${key}.`);
    if (
      typeof p.explodedGap !== 'number' ||
      !Number.isFinite(p.explodedGap) ||
      p.explodedGap < 10 ||
      p.explodedGap > 60
    )
      errors.push('Inspection separation must be between 10 and 60 mm.');
    if (!['assembled', 'frame', 'drive', 'exploded'].includes(state))
      errors.push('Choose a supplier chassis inspection view.');
    return errors;
  },
  buildGeometry: geometry,
  buildExportGeometry: geometry,
  python,
  dimensions,
  assessment(p) {
    const m = selected(p);
    return [
      `${m.name}: original ${m.manufacturer} CAD, ${m.dimensions.map((v) => v.toFixed(2)).join(' × ')} mm; ${m.components.reduce((n, c) => n + (c.solids ?? 1), 0)} retained source solids in ${m.components.length} CAD components.`,
      m.mounting,
      m.equipment,
      m.power,
      m.scope,
      ...(m.mountingSurfaces ?? [])
        .filter((s) => /equipment deck/i.test(s.label))
        .map(
          (s) =>
            `Measured original equipment face: ${s.area.toFixed(0)} mm² net planar area at Z=${s.z.toFixed(2)} mm; its cutouts and mounting features are retained.`,
        ),
      ...((m.omissions?.length ?? 0)
        ? [
            `${m.omissions!.length} defective or non-volumetric electronic source features are excluded; the factory frame, drive and mounting geometry are retained. Details are included in the source/mounting JSON download.`,
          ]
        : []),
      'Supplier internal parts remain part of the purchased chassis. Source CAD is preserved; no arbitrary scaling, invented mounting grid or generic motor adapter is substituted.',
    ];
  },
  fabricationFiles(p) {
    const m = selected(p),
      quote = (v: unknown) => '"' + String(v).replaceAll('"', '""') + '"';
    return [
      {
        id: 'source-scope',
        name: `${m.id}-source-and-mounting.json`,
        label: 'Source, equipment space and kit contents',
        description: 'Original CAD revision, purchase links, mounting guidance and source scope',
        type: 'application/json',
        content: JSON.stringify(
          {
            model: m.name,
            manufacturer: m.manufacturer,
            productUrl: m.productUrl,
            resourcesUrl: m.resourcesUrl,
            sourceUrl: m.sourceUrl,
            sourceSha256: m.sourceSha256,
            sourceFile: m.sourceFile,
            cadDimensions: m.dimensions,
            coordinateSystem: {
              unit: 'mm',
              reference: 'Unseparated supplier assembly; all views use the same mounting coordinates.',
              origin: 'Source assembly envelope centre in X/Y, lowest source point at Z=0.',
              sourceTransform: m.normalization,
            },
            mounting: m.mounting,
            equipment: m.equipment,
            power: m.power,
            scope: m.scope,
            mountingSurfaces: m.mountingSurfaces,
            sourceNotes: m.sourceNotes,
            sourceOmissions: m.omissions,
            previewNotes: m.components
              .filter((c) => c.previewNotes?.length)
              .map((c) => ({ id: c.id, label: c.label, notes: c.previewNotes })),
            references: m.references,
          },
          null,
          2,
        ),
      },
      {
        id: 'mounting-bores',
        name: `${m.id}-source-mounting-bores.csv`,
        label: 'Measured source mounting faces and circular bores',
        description:
          'Source planar face areas and verified round bores in mm; excludes undimensioned slot ends and partial arcs',
        type: 'text/csv',
        content:
          'Source component,Face,Face Z mm,Net face area mm2,Hole X mm,Hole Y mm,Hole diameter mm\n' +
          (m.mountingSurfaces ?? [])
            .flatMap((face) =>
              face.circles.length
                ? face.circles.map((hole) =>
                    [
                      face.componentId,
                      face.label,
                      face.z,
                      face.area,
                      hole.x,
                      hole.y,
                      2 * hole.radius,
                    ]
                      .map(quote)
                      .join(','),
                  )
                : [
                    [face.componentId, face.label, face.z, face.area, '', '', '']
                      .map(quote)
                      .join(','),
                  ],
            )
            .join('\n'),
      },
      {
        id: 'source-components',
        name: `${m.id}-cad-components.csv`,
        label: 'Source component inventory',
        description:
          'Named supplier CAD solids and bounds in mm; an internal CAD inventory, not separate procurement articles',
        type: 'text/csv',
        content:
          'Source ID,Label,Role,X min,Y min,Z min,X max,Y max,Z max,Native volume mm3\n' +
          selectedComponents(p, 'assembled')
            .map((c) => [c.id, c.label, c.group, ...c.bounds, c.volume].map(quote).join(','))
            .join('\n'),
      },
    ];
  },
  notes:
    'Fixed commercial chassis from original supplier STEP files. Source hashes and exact source configuration are retained. Frame-only and drive-only states isolate existing source parts; inspection offsets do not change the purchased design. Manufacturer CAD can omit retail-kit components or include optional accessories: consult the model-specific scope. Pirate source revision differs from current published dimensions; the measured original CAD is not rescaled to match another revision. Purchasing a kit does not grant an assumed CAD manufacturing license. No load rating is invented by this library.',
  sources: models.flatMap((m) => [
    { label: m.name + ' product and kit contents', url: m.productUrl },
    { label: m.name + ' original CAD', url: m.sourceUrl },
    ...m.references,
  ]),
};
export default part;
