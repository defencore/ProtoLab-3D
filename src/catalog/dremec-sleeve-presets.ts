/** The DH source offers custom manufacture, not a finite stock SKU cross product. */
import sources from '../parts/dremec-spacer-sleeve/sources.json';
import { defaults } from '../parts/dremec-spacer-sleeve/configurator';
import type { Preset } from '../core/types';

export function dremecSleevePresets(): Preset[] {
  return sources.map((source) => {
    const example = 'orderExample' in source ? source.orderExample : undefined;
    const parameters = { ...defaults, material: source.material };
    return {
      id: `dremec-dh-${source.material}`,
      name: example
        ? 'DREMEC steel sleeve — 324/2.1x10 order example'
        : `DREMEC ${source.material} sleeve — custom dimensions`,
      description: example
        ? 'Printed manufacturer order example: outside diameter 4 mm, bore 2.1 mm, length 10 mm. Dimensions remain editable for a custom order.'
        : 'Customer-specified sleeve. The initial 4 / 2.1 / 10 mm dimensions are an editable example, not a published stock SKU.',
      parameters,
      product: { supply: 'purchased' },
      catalog: {
        designation: example?.sku ?? `DH ${source.material} — customer dimensions`,
        manufacturer: 'DREMEC',
        sourceName: 'DREMEC Ukraine',
        sourceUrl: source.url,
        verifiedParameters: example
          ? ['material', 'outerDiameter', 'bore', 'length']
          : ['material'],
        parameterRanges: { outerDiameter: { min: 4, max: 36 }, length: { min: 1, max: 60 } },
        alternateSourceUrls: [source.drawingUrl],
        geometryEvidence: {
          kind: example ? 'source-dimensions' : 'envelope',
          summary: example
            ? 'The printed manufacturer example defines 4 mm outside diameter, 2.1 mm bore and 10 mm body length.'
            : 'The manufacturer publishes a custom-order range; these initial dimensions are customer-requested examples.',
          limitations:
            'No stock availability is asserted. Specify bore, tolerances and edge breaks with the order; these details are not published for the editable nominal model.',
          sourceUrl: source.drawingUrl,
          sourceSha256: '747c189d30afb816825a33934aec4f08c1c3154543ba48338f489862ecb9fd55',
        },
        specifications: [
          {
            label: 'Ordering',
            value: 'Made to customer dimensions; not a generated stock combination.',
          },
          { label: 'Material grade', value: source.materialGrade },
          { label: 'Finish', value: source.finish },
          { label: 'Outside diameter range', value: '4–36 mm' },
          { label: 'Body length range', value: '1–60 mm' },
          {
            label: 'Through bore',
            value: 'Customer-specified; must be smaller than outside diameter.',
          },
          { label: 'Manufacturer drawing', value: '2020 catalog, printed page 36.' },
        ],
      },
    };
  });
}
