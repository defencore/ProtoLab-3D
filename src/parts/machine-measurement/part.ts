import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { measurementPieces } from './lib/model';
import { geometry, dimensions, python } from './lib/assembly';
const part: PartDefinition = {
  id: 'machine-measurement',
  name: 'Machine measurement sensors',
  category: 'MACHINE TOOLS',
  subgroup: 'MEASUREMENT & SENSORS',
  icon: 'circuit',
  complexity: 'Purchased instrumentation',
  description:
    'Material-contact measuring wheel, through-beam part detection and inductive machine-position sensing.',
  keywords: ['encoder', 'sensor', 'measuring', 'Kuebler', 'Omron', 'tube'],
  parameters,
  defaults,
  presets: presets as Preset[],
  validate: (p) =>
    ['mwe21', 'e3z-t81', 'e2b-m12'].includes(String(p.model))
      ? []
      : ['Select a supported instrument.'],
  buildGeometry: (p) => geometry(measurementPieces(p)),
  dimensions: (p) => dimensions(measurementPieces(p)),
  python: (p) => python(measurementPieces(p)),
  notes:
    'Purchased instruments, not fabrication geometry. MWE21 wheel circumference and encoder diameter are sourced; spring-arm contour, encoder depth and bracket holes are planning envelopes awaiting the exact ordered drawing. E3Z is sold as emitter/receiver pair: the standalone model shows one sensor. E2B nominal thread is smooth. Standard sensors do not implement a safety function. 0.05 mm quadrature resolution does not establish length accuracy.',
  sources: [
    {
      label: 'Kuebler MWE21 measuring system',
      url: 'https://www.kuebler.com/en/products/measurement/linear-measuring-systems/product-finder/product-details/MWE21',
    },
    {
      label: 'OMRON E3Z dimensions',
      url: 'https://www.ia.omron.com/products/family/407/dimension.html',
    },
    {
      label: 'OMRON E2B dimensions',
      url: 'https://www.ia.omron.com/data_pdf/cat/e2b_d116-e1_1_6_csm1012652.pdf',
    },
  ],
};
export default part;
