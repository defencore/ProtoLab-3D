import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import data from './presets.json';
import sources from './sources.json';
import { defaults, parameters, catalogSelection } from './configurator';
import { cylinder, subtract } from '../../core/assembly/boundary/shapes';
import * as assembly from '../../core/assembly/boundary/assembly';

function source(p: Parameters) {
  return sources.find((item) => item.material === p.material);
}
function pieces(p: Parameters) {
  return [
    {
      label: 'DREMEC customer-specified metal sleeve',
      color: 0xbfc5cc,
      shape: subtract(
        cylinder(Number(p.outerDiameter) / 2, Number(p.length), [0, 0, 0]),
        cylinder(Number(p.bore) / 2, Number(p.length) + 2, [0, 0, 0]),
      ),
    },
  ];
}
const part: PartDefinition = {
  id: 'dremec-spacer-sleeve',
  browseFamily: { id: 'spacers-standoffs', label: 'Spacers & standoffs' },
  name: 'DREMEC custom metal sleeve',
  product: product as ProductProfile,
  category: 'FASTENERS & THREADS',
  subgroup: 'SPACERS & STANDOFFS',
  icon: 'bolt',
  complexity: 'Made to customer dimensions',
  description:
    'Choose the supplier material and specify a plain through-bore sleeve within the published custom-order range.',
  keywords: [
    'DREMEC',
    'spacer',
    'sleeve',
    'bushing',
    'DH',
    'brass',
    'steel',
    'aluminium',
    'stainless',
    'custom order',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: data as Preset[],
  validate(p) {
    const errors: string[] = [];
    if (!source(p)) errors.push('Choose a published DREMEC sleeve material.');
    if (
      ![p.outerDiameter, p.bore, p.length].every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      )
    )
      return [...errors, 'Enter finite sleeve dimensions.'];
    if (
      Number(p.outerDiameter) < 4 ||
      Number(p.outerDiameter) > 36 ||
      Number(p.length) < 1 ||
      Number(p.length) > 60
    )
      errors.push('The published sleeve range is 4–36 mm outside diameter and 1–60 mm length.');
    if (!(Number(p.bore) > 0 && Number(p.bore) < Number(p.outerDiameter)))
      errors.push('The through bore must be positive and smaller than the outside diameter.');
    return errors;
  },
  buildGeometry: (p) => assembly.geometry(pieces(p)),
  python(p) {
    const selected = source(p)!;
    return `${assembly.python(pieces(p))}\ncomponent_metadata = ${JSON.stringify([
      {
        Supplier: 'DREMEC',
        SupplierProductSource: selected.url,
        SupplierMaterialGrade: selected.materialGrade,
        SupplierFinish: selected.finish,
        CustomOrderDimensions: JSON.stringify({
          outsideDiameter: p.outerDiameter,
          bore: p.bore,
          length: p.length,
        }),
        OrderStatus: 'Customer-specified geometry; no stock SKU or availability claim.',
        DrawingSource: selected.drawingUrl,
      },
    ])}`;
  },
  dimensions: (p) => [Number(p.outerDiameter), Number(p.outerDiameter), Number(p.length)],
  assessment: (p) => [
    `Custom order in ${String(p.material)}. Supply the requested dimensions and drawing to DREMEC; this is not a generated stock combination.`,
  ],
  notes:
    'Unthreaded sleeve with square nominal ends. Outside diameter and length follow the published custom ranges; bore, tolerances and edge breaks must be specified by the customer. The steel default reproduces printed order example 324/2.1x10. Other material templates use the same customer-requested dimensions and are not asserted to be stocked catalog SKUs. Simple and Full have the same unthreaded geometry.',
  sources: sources.map((item) => ({ label: item.name, url: item.url })),
};
export default part;
