import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { box, cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import product from './product.json';
import presets from './presets.json';
export function precisionCouplingParameters(screwBore: 15 | 20 = 20): Parameters {
  return { model: 'bk2-15-59', motorBore: 19, screwBore: String(screwBore) };
}
export function precisionCouplingLayout(p: Parameters) {
  return {
    length: 59,
    outside: 49,
    hubLength: 22,
    minimum: -29.5,
    maximum: 29.5,
    motorHubStart: -29.5,
    motorHubEnd: -7.5,
    screwHubStart: 7.5,
    screwHubEnd: 29.5,
    motorBore: Number(p.motorBore),
    screwBore: Number(p.screwBore),
    keyWidth: 6,
    keywayTop: 12.3,
    torqueNm: 15,
    torsionalNmPerRad: 20000,
    inertiaKgM2: 6e-5,
    massKg: 0.16,
  };
}
function pieces(p: Parameters): Piece[] {
  const v = precisionCouplingLayout(p),
    result: Piece[] = [];
  for (const [side, bore, start] of [
    ['motor', v.motorBore, -29.5],
    ['screw', v.screwBore, 7.5],
  ] as const) {
    const tools: Shape[] = [
      cylinder(bore / 2, 24, [start - 1, 0, 0], 'x'),
      box([24, 1, 25], [start - 1, -0.5, 0]),
    ];
    if (side === 'motor') tools.push(box([24, 12.3, 6.1], [start - 1, 0, -3.05]));
    result.push({
      label: `R+W BK2/15${side} clamping hub; sourceØ49/fit22`,
      color: 0xadb6be,
      shape: subtract(cylinder(24.5, 22, [start, 0, 0], 'x'), ...tools),
    });
  }
  let bellows: Shape = cylinder(18, 15, [-7.5, 0, 0], 'x');
  for (let i = 0; i < 6; i++)
    bellows = union(bellows, cylinder(23, 1, [-7.5 + i * 2.5, 0, 0], 'x'));
  result.push({
    label: 'Stainless bellows; corrugation count/profile envelope',
    color: 0x919ca6,
    shape: subtract(bellows, cylinder(15, 17, [-8.5, 0, 0], 'x')),
  });
  return result;
}
const part: PartDefinition = {
  id: 'cnc-precision-coupling',
  name: 'Precision metal bellows coupling',
  product: product as ProductProfile,
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'SHAFT COUPLINGS',
  icon: 'gear',
  complexity: 'R+W BK2/15/59 source15Nm keyed clamp execution',
  description:
    'Ordered R+W BK2/15/59 metal bellows coupling with 19 mm keyedmotorhub and15/20 mm precision screw hub; real source torsional rating and explicit order drawing requirement.',
  keywords: ['R+W', 'BK2', 'metal bellows', 'zero backlash', '19mm', '15Nm', 'precision coupling'],
  defaults: precisionCouplingParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Source coupling',
      type: 'select',
      group: 'Model',
      options: [{ value: 'bk2-15-59', label: 'R+W BK2/15/59' }],
    },
    {
      key: 'motorBore',
      label: 'Ordered motor boreH7',
      type: 'number',
      unit: 'mm',
      group: 'Order',
      min: 19,
      max: 19,
      step: 1,
    },
    {
      key: 'screwBore',
      label: 'Ordered screw boreH7',
      type: 'select',
      group: 'Order',
      options: [
        { value: '15', label: '15mm' },
        { value: '20', label: '20mm' },
      ],
    },
  ],
  presets: presets as Preset[],
  validate(p) {
    return p.model === 'bk2-15-59' &&
      Number(p.motorBore) === 19 &&
      [15, 20].includes(Number(p.screwBore))
      ? []
      : ['Choose source BK2/15/59 with 19 mm keyedmotorhub and15/20 mm screw bore.'];
  },
  buildGeometry: (p) => geometry(pieces(p)),
  python: (p) =>
    `${python(pieces(p))}\ncomponent_manufactured=[False]*len(components)\nfor _pl_coupling_meta in component_metadata: _pl_coupling_meta.update(${JSON.stringify({ ManufacturerRatings: JSON.stringify(precisionCouplingLayout(p)), OrderExecution: 'R+W BK2/15/59, D1=19H7with optional DIN6885keyway matching6×6key, D2=15/20H7. Actual keyway depth/length/shape, clamp screw positions and ordered factory drawing require approval. Hub/key installation cannot be replaced by a genericjawcoupling.', GeometryQualification: 'PublishedØ49/L59/fit22. Bellows thickness/corrugations, clamp slit and optional keyway depth12.3radial are illustrative envelopes; no stress/fatigue qualification from CAD. Use maker tightening8Nm/clampM5 and alignmentlimits; ordered drawing required.' })})`,
  dimensions: () => [59, 49, 49],
  notes:
    'Native axis X, overall−29.5..29.5. Motorhub−29.5..−7.5, screwhub7.5..29.5; hubfit22, shafttipgap15. Source15Nm,20,000Nm/rad,6e−5kgm², approximate.16kg. Manufacturer offersDIN/ANSIkeyway option; motor-side19H7/6mmkeyway must be confirmed by factorydrawing before purchase. Defaultkeyway model has12.3mmradial top envelope to clear sourcekeytop12; this value is authored fit, not publishedfactory keyway tolerancing.',
  sources: [
    { label: 'R+W BK2 primary source', url: 'https://www.rw-couplings.com/product/bk2/' },
    {
      label: 'R+Wprecision couplings maker drawing p24',
      url: 'https://www.rw-couplings.com/wp-content/uploads/PDFs/RW-Handbuch/RW_Guidebook_Precision-Couplings.pdf',
    },
  ],
};
export default part;
