import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import measurement from '../machine-measurement/part';
import { defaults, parameters } from './configurator';
import profile from './product.json';
import presets from './presets.json';
const model = { model: 'e2b-m12' };
const source = 'https://www.ia.omron.com/data_pdf/cat/e2b_d116-e1_1_6_csm1012652.pdf';
const part: PartDefinition = {
  id: 'cnc-limit-sensor',
  product: profile as ProductProfile,
  name: 'OMRON E2B M12 inductive limit sensor',
  category: 'ELECTRONICS & VISION',
  subgroup: 'SENSORS & SWITCHES',
  icon: 'circuit',
  complexity: 'Purchased PNP inductive sensor',
  description:
    'One identified 4 mm OMRON PNP NO inductive motion-limit sensor with source evidence and nominal installation contours.',
  keywords: ['CNC', 'OMRON', 'E2B', 'M12', 'inductive', 'limit', 'PNP', '4 mm'],
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
  catalogSelection: [{ key: 'model' }],
  presetMatchKeys: ['model'],
  catalogFilterFields: [
    {
      key: 'bodyDiameter',
      label: 'Body diameter',
      type: 'number',
      group: 'Source dimensions',
      unit: 'mm',
      catalogSummary: true,
    },
  ],
  validate: (p) =>
    p.model === 'e2b-m12' ? [] : ['Select the identified OMRON E2B-M12KS04-WP-B1 2M execution.'],
  buildGeometry: (_p, state) => measurement.buildGeometry(model, state),
  buildExportGeometry: (_p, state) => measurement.buildGeometry(model, state),
  dimensions: (_p, state) => measurement.dimensions(model, state),
  python: (_p, state) =>
    measurement.python(model, state) +
    `\ncomponent_manufactured = [False]*len(components)\ncomponent_metadata = [${JSON.stringify({
      PurchasedUnit:
        'OMRON E2B-M12KS04-WP-B1 2M, supplied mounting nuts remain one purchase identity',
      SupplierThreadDesignation:
        'M12 x P1 body; span and delivered fit unverified, nominal in Simple and Full',
      GeometryLimitations:
        'Added face layer, round nut contours, nut positions and cable tail are installation envelopes; washer and sensor internals are not reconstructed.',
      ManufacturerSource: source,
    })}]*len(components)`,
  assessment: () => [
    'The 4 mm nominal rating requires the correct ferrous target and source surrounding-metal clearance; commission a smaller reliable operating gap.',
    'PNP NO ordinary motion sensing does not implement an emergency or safety function.',
    'Verify the delivered nut/sensing-face datums; this purchased installation model retains nominal thread/body subdivisions in both modes.',
  ],
  notes:
    'Purchased manufacturer execution, not a production sensor drawing. M12 x P1 and47 mm short body are source dimensions. The existing nominal installation geometry is reused without claiming factory internals: face at47.5 mm, mounting nuts18..22 and27..31, round nut contours and cable tail remain illustrative. No body helix or unspecified thread span is invented in either Simple or Full. The supplied toothed washer is not modeled; verify its installation before fixing bracket/nut positions. Standard proximity sensors do not implement a safety function.',
  sources: [{ label: 'OMRON E2B short M12 dimensions and installation requirements', url: source }],
};
export default part;
