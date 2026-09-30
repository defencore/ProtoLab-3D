import type { PartDefinition, Preset } from '../../core/types';
import { parameters, defaults } from './configurator';
import presets from './presets.json';
import { bladePieces } from './lib/model';
import { geometry, python } from './lib/assembly';
const part: PartDefinition = {
  id: 'circular-saw-blade',
  name: 'Circular saw blade',
  category: 'MACHINE TOOLS',
  subgroup: 'SAW BLADES',
  description:
    'Freud LU5H 500 mm carbide blade for non-ferrous material. Purchased tooling with fixed supplier dimensions.',
  keywords: ['saw', 'blade', 'aluminium', 'Freud', 'LU5H'],
  icon: 'wheel',
  complexity: 'Purchased cutting tool',
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelectionOnly: true,
 catalogFilterFields:[{key:'bore',label:'Bore diameter',type:'number',unit:'mm',min:0,max:500,step:0.01,group:'Dimensions',catalogSummary:true}],
  presetMatchKeys: ['model'],
  catalogSelection: [{ key: 'model' }],
  validate: (p) =>
    ['lu5h50001', 'lu5h50002'].includes(String(p.model)) ? [] : ['Select a catalog blade.'],
  buildGeometry: (p) => geometry(bladePieces(p)),
  dimensions: () => [500, 500, 4],
  python: (p) =>
    python(bladePieces(p)) +
    '\ncomponent_manufactured = [False]\ncomponent_groups = [["Cutting tool"]]\ncomponent_metadata = [{"Procurement":"BUY_STANDARD","GeometryEvidence":"Supplier diameter, bore, body, kerf, tooth count and pin-hole PCDs; illustrative tooth form and relative pin-hole clocking","SpeedLimit":"Confirm the marked maximum RPM and application with the blade supplier"}]',
  notes:
    'Do not manufacture a blade from this reference model. Tooth grinding, brazing, tensioning and balance are supplier processes; slots and exact tooth profile are not reproduced.',
  sources: [
    {
      label: 'Freud LU5H manufacturer dimensions',
      url: 'https://www.freudtools.com/worldwide/media/downloads/product_finders/csb/fr_k_csb_flyer_lu5h_mkfrm_255_eng_low_psw.pdf',
    },
  ],
};
export default part;
