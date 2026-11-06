import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { parameters } from './configurator';
import { bearingGeometry, bearingPython, validateBearing } from './lib/model';
import { n } from '../../core/geometry';

const part: PartDefinition = {
  id: 'flanged-ball-bearing',
  product: product as ProductProfile,
  name: 'Flanged miniature ball bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'BALL BEARINGS',
  description:
    'Miniature deep-groove bearing with an integral outer-ring locating flange and selectable rubber seals or metal shields.',
  keywords: [
    'flange',
    'flanged',
    'miniature',
    'F623',
    'F686',
    'F688',
    'F689',
    'F695',
    'F696',
    'F698',
    'F608',
    '2RS',
    'MF105',
    'MF106',
    'MF63',
    'SMB',
    'Prom.ua',
    '2Z',
    'ZZ',
  ],
  icon: 'bearing',
  standard: 'Metric F-series size references',
  complexity: 'Assembly',
  parameters,
  defaults: presets[0].parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembled', description: 'Nominal bearing installation envelope.' },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the rings to inspect the ball set.',
    },
  ],
  presetMatchKeys: ['bore', 'outer', 'width', 'flangeOuter', 'flangeWidth', 'seals'],
  validate: validateBearing,
  buildGeometry: bearingGeometry,
  python: bearingPython,
  dimensions: (p, state) => [
    n(p, 'flangeOuter'),
    n(p, 'flangeOuter'),
    n(p, 'width') * (state === 'exploded' ? 2.8 : 1),
  ],
  sources: [
    {
      label: 'AliExpress · requested flanged bearing options',
      url: 'https://www.aliexpress.us/item/3256808281231823.html',
    },
    {
      label: 'Fitrun · miniature bearing dimensions',
      url: 'https://www.fitrunbearing.com/wp-content/uploads/2022/09/miniature-ball-bearings-catalogue-pdf.pdf',
    },
  ],
  notes:
    'Requested bore, body diameter, width and 2RS closure come from the supplied option list. Flange dimensions use independent manufacturer references and do not establish interchangeability with the seller. Ball count, raceways, cage and seal profiles are illustrative. Overall width includes the flange.',
};
export default part;

export { promActuatorBearings, promBearing } from './lib/prom-catalog';
