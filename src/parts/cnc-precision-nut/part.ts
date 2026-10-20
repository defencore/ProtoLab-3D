import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';
export type PrecisionScrewModel = 'r25-10t3-fdi' | 'r20-5t3-fdi';
export const precisionScrewSource =
  'https://www.hiwin.de/medias/sys_master/hiwinDocumentMedia/hc3/h19/14757156519966/HIWIN%20CATALOGUE%20BALLSCREWS/HIWIN-CATALOGUE-BALLSCREWS.PDF?attachment=true';
export function precisionNutParameters(model: PrecisionScrewModel = 'r25-10t3-fdi'): Parameters {
  return { model };
}
export function precisionNutLayout(p: Parameters) {
  const large = p.model === 'r25-10t3-fdi';
  return {
    model: p.model as PrecisionScrewModel,
    shaftDiameter: large ? 25 : 20,
    lead: large ? 10 : 5,
    rootDiameter: large ? 21.13 : 17.32,
    ballDiameter: large ? 4.763 : 3.175,
    bodyDiameter: large ? 51 : 34,
    length: large ? 140 : 78,
    flangeDiameter: large ? 74 : 57,
    flangeThickness: large ? 15 : 12,
    flangeMatingFace: 0,
    minimum: large ? -15 : -12,
    maximum: large ? 125 : 66,
    fitStart: 0,
    fitEnd: 24,
    mountingCircle: large ? 60 : 45,
    mountBore: large ? 6.6 : 5.5,
    counterbore: large ? 11 : 9.5,
    counterboreDepth: large ? 6.5 : 5.5,
    sourceDynamicN: large ? 16430 : 8520,
    sourceStaticN: large ? 32650 : 17670,
    sourceRigidityAtTenPercentNPerUm: large ? 490 : 390,
    sourceMassKg: large ? 1.38 : 0.49,
  };
}
export function precisionNutMountingHoles(p: Parameters): [number, number, number][] {
  const radius = precisionNutLayout(p).mountingCircle / 2;
  return [30, 90, 150, 210, 270, 330].map((angle) => [
    0,
    radius * Math.cos((angle * Math.PI) / 180),
    radius * Math.sin((angle * Math.PI) / 180),
  ]);
}
function pieces(p: Parameters): Piece[] {
  const v = precisionNutLayout(p);
  const tools: Shape[] = [
    cylinder((v.shaftDiameter + 0.2) / 2, v.length + 2, [v.minimum - 1, 0, 0], 'x'),
  ];
  for (const [, y, z] of precisionNutMountingHoles(p))
    tools.push(
      cylinder(v.mountBore / 2, v.flangeThickness + 2, [v.minimum - 1, y, z], 'x'),
      cylinder(v.counterbore / 2, v.counterboreDepth, [v.minimum, y, z], 'x'),
    );
  const body = subtract(
    union(
      cylinder(v.bodyDiameter / 2, v.maximum, [0, 0, 0], 'x'),
      cylinder(v.flangeDiameter / 2, v.flangeThickness, [v.minimum, 0, 0], 'x'),
    ),
    ...tools,
  );
  return [
    {
      label: `${String(p.model).toUpperCase()} purchased double nut; undisclosed internals opaque`,
      color: 0xa1abb4,
      shape: body,
    },
  ];
}
const part: PartDefinition = {
  id: 'cnc-precision-nut',
  name: 'Ground ballscrew double nut',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'HIWIN FDI source interface; factory matched set',
  description:
    'Source-specific HIWIN FDI double nut with actual flange fit, counterbores and opaque supplier internals; ordered precision/preload require certificates.',
  keywords: ['HIWIN', 'FDI', 'ground', 'double nut', '25x10', '20x5', 'C3 order', 'preload'],
  defaults: precisionNutParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Source nut execution',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'r25-10t3-fdi', label: 'HIWIN R25-10T3-FDI ·25×10' },
        { value: 'r20-5t3-fdi', label: 'HIWIN R20-5T3-FDI ·20×5' },
      ],
    },
  ],
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'nominalShaft',
      label: 'Source nominal screw diameter',
      type: 'number',
      unit: 'mm',
      group: 'Source',
      catalogSummary: true,
    },
    {
      key: 'sourceLead',
      label: 'Source lead',
      type: 'number',
      unit: 'mm',
      group: 'Source',
      catalogSummary: true,
    },
    { key: 'flange', label: 'Flange diameter', type: 'number', unit: 'mm', group: 'Source' },
    { key: 'nutLength', label: 'Nut overall length', type: 'number', unit: 'mm', group: 'Source' },
  ],
  validate: (p) =>
    ['r25-10t3-fdi', 'r20-5t3-fdi'].includes(String(p.model))
      ? []
      : ['Choose the actual HIWIN FDI25×10 or20×5 source interface.'],
  buildGeometry: (p) => geometry(pieces(p)),
  python(p) {
    return `${python(pieces(p))}\ncomponent_manufactured=[False]*len(components)\nfor _pl_fdi_meta in component_metadata: _pl_fdi_meta.update(${JSON.stringify({ MatchedSetRequirement: 'Order with the same ground shaft; requested C3 accuracy and3% dynamic-load preload require manufacturer quote, factory-approved end drawing, measured lead/backlash/preload torque certificates and set identity. No delivery/certificate approval is inferred.', GeometryQualification: 'Only published nut envelope, flange, fit land and bolt/counterbore interfaces. Central clearing bore is an inspection envelope, not OEM contact geometry; no racecontact/preload validation from this CAD.', SourceRatings: JSON.stringify(precisionNutLayout(p)), RigidityQualification: 'CatalogueK490/390N per micron is theoretical at10% preload; not stiffness at the requested 3% preload.' })})`;
  },
  dimensions: (p) => {
    const v = precisionNutLayout(p);
    return [v.length, v.flangeDiameter, v.flangeDiameter];
  },
  notes:
    'Native screw axisX. Flange/body mating planeX0; flange−15..0/−12..0, fitland0..24, body to125/66. Counterbores open from−X. Six holes at30,90,150,210,270,330deg on source PCD60/45. Purchased factory-matched precision nut: this CAD does not reveal spacer, ball tracks/return or production preload. C3/3% are explicit purchase and acceptance requirements; ground class is not reassigned from genericSFU. Catalogue stiffness applies at10% preload only.',
  sources: [
    { label: 'HIWIN ground FDI table6.7 and source drawing', url: precisionScrewSource },
    {
      label: 'HIWIN maker S99TE22-2009 FDI drawing, p72',
      url: 'https://www.hiwin.com/wp-content/uploads/Ballscrew-Catalog.pdf',
    },
  ],
};
export default part;
