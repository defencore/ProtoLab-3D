import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import { defaults, parameters, catalogSelection } from './configurator';
import {
  models,
  selected,
  geometry,
  printingGeometry,
  python,
  dimensions,
  validate,
} from './lib/model';
export { default as sourceAudit } from './lib/source-audit.json';

export {
  models,
  selected,
  geometry,
  python,
  dimensions,
  validate,
  sourceColorOverrides,
} from './lib/model';
export type { RovSourceComponent, RovNativeComponent } from './lib/model';

export const sourcePresets: Preset[] = models.map((model) => ({
  id: model.id,
  name: `${model.projectName} · ${model.label}`,
  description: `Original ${model.format.toUpperCase()} fabrication part; ${model.route}. ${model.material}`,
  parameters: { component: model.id },
  product: { supply: 'manufactured' },
  catalog: {
    designation: model.label,
    manufacturer: `${model.projectName} contributors`,
    sourceName: 'Pinned original ROV project geometry',
    sourceUrl: model.sourceUrl,
    verifiedParameters: ['component'],
    geometryEvidence: {
      kind: 'community-cad',
      summary:
        model.format === 'step'
          ? 'Original STEP component retained as native BREP with a source-derived preview.'
          : 'Original STL coordinates and triangle connectivity retained without welding or scaling.',
      limitations:
        'Source geometry and project instructions do not establish a manufacturing tolerance or a qualified operating depth.',
      sourceUrl: model.sourceUrl,
      sourceSha256: model.sourceSha256,
    },
    attributes: {
      project: model.projectName,
      route: model.route,
      license: model.license,
      sourceFormat: model.format.toUpperCase(),
      width: model.dimensions[0],
      depth: model.dimensions[1],
      height: model.dimensions[2],
    },
    specifications: [
      { label: 'Source revision', value: model.revision },
      { label: 'Hardware license', value: model.license },
      { label: 'Material / stock', value: model.material },
    ],
  },
}));

const choices = (values: string[]) =>
  [...new Set(values)].map((value) => ({ value, label: value }));
const part: PartDefinition = {
  id: 'rov-component',
  browseLabel: 'ROV fabrication detail',
  name: 'ROV fabrication parts',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'UNDERWATER ROVS',
  icon: 'bracket',
  product: profile as ProductProfile,
  description:
    'Six original FinsROV making definitions: one printed pressure-sensor mount and five machined aluminium details. Purchased servos, thrusters, sensors and enclosure units are separate products.',
  complexity: 'Original project geometry',
  preview: 'worker',
  validationNotice:
    'Print only the pressure-sensor mount. Use the native CAD for machined metal details; buy the separate equipment complete.',
  keywords: [
    'ROV',
    'underwater',
    'submarine',
    'open source',
    'STL',
    'STEP',
    'printing',
    'machining',
  ],
  defaults,
  parameters,
  presets: sourcePresets,
  presetMatchKeys: ['component'],
  catalogSelection,
  catalogSelectionOnly: true,
  catalogFilterFields: [
    {
      key: 'project',
      label: 'ROV project',
      group: 'Source',
      type: 'select',
      options: choices(models.map((model) => model.projectName)),
      catalogSummary: true,
    },
    {
      key: 'route',
      label: 'Manufacturing route',
      group: 'Fabrication',
      type: 'select',
      options: choices(models.map((model) => model.route)),
      catalogSummary: true,
    },
    {
      key: 'license',
      label: 'Hardware license',
      group: 'Source',
      type: 'select',
      options: choices(models.map((model) => model.license)),
    },
    {
      key: 'sourceFormat',
      label: 'Original format',
      group: 'Source',
      type: 'select',
      options: choices(models.map((model) => model.format.toUpperCase())),
    },
    {
      key: 'width',
      label: 'Source X extent',
      group: 'Source dimensions',
      type: 'number',
      unit: 'mm',
    },
    {
      key: 'depth',
      label: 'Source Y extent',
      group: 'Source dimensions',
      type: 'number',
      unit: 'mm',
    },
    {
      key: 'height',
      label: 'Source Z extent',
      group: 'Source dimensions',
      type: 'number',
      unit: 'mm',
    },
  ],
  states: [
    {
      id: 'default',
      label: 'Original source part',
      description: 'Source component in its retained source coordinates and scale.',
    },
  ],
  validate,
  buildGeometry: geometry,
  buildExportGeometry: printingGeometry,
  dimensions,
  // FreeCAD uses this envelope too. Native CNC export must remain available.
  exportDimensions: dimensions,
  python,
  assessment(p) {
    const model = selected(p);
    return [
      `${model.projectName}: ${model.label}. Original ${model.sourcePath}, revision ${model.revision}.`,
      model.format === 'step'
        ? 'Native STEP surfaces are retained as BREP; the display is a triangulated source preview.'
        : 'Original STL mesh: source vertices and triangles are unchanged. FreeCAD export creates faceted solids from that mesh; it does not reconstruct analytic CAD.',
      `Measured source extent: ${model.dimensions.map((value) => value.toFixed(3)).join(' × ')} mm; ${model.solidCount} source solid(s).`,
      `Fabrication route: ${model.route}. Material / stock: ${model.material}.`,
      model.route === 'printing'
        ? 'This is a source-defined printed physical detail. The assembly records its required quantity and installed placement.'
        : 'This is a machined metal detail. Printable STL export is disabled; use the FreeCAD macro or original STEP to plan machining.',
      ...model.requirements,
      `Hardware license: ${model.license}. Retain upstream attribution and the selected source notice when redistributing.`,
    ];
  },
  fabricationFiles(p) {
    const model = selected(p);
    return [
      {
        id: 'source-provenance',
        label: 'Original source and fabrication record',
        description:
          'Source URL, revision, SHA-256, license, material and process requirements · JSON',
        name: `${model.id}-source.json`,
        type: 'application/json',
        content: JSON.stringify(model, null, 2),
      },
    ];
  },
  notes:
    'Only six confirmed FinsROV making definitions are active. Every definition is one physical solid. STL making export is available only for the printed pressure-sensor mount; CNC details retain native FreeCAD/STEP export. Purchased equipment is kept in its own package and receives no manufacturing route. The actual assembly defines part quantities and placements.',
  sources: models.flatMap((model) => [
    { label: `${model.projectName} · ${model.label} original source`, url: model.sourceUrl },
    { label: `${model.projectName} hardware license: ${model.license}`, url: model.licenseUrl },
  ]),
};
export default part;
