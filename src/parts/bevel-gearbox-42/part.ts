import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { geometry, python, dimensions } from './lib/model';
const part: PartDefinition = {
  id: 'bevel-gearbox-42',
  name: 'Bevel gearbox · 42 mm · 1:1',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'REDUCERS & DIFFERENTIALS',
  icon: 'gear',
  complexity: 'Source housing · reconstructed internals',
  description:
    '42 mm aluminium cube with two or three M1 / 20T spiral-bevel references, 61802 bearings and separate shaft/bore circlips at every gear.',
  keywords: [
    'bevel',
    'miter',
    'angle gearbox',
    '42x42x42',
    '1005006771991196',
    '6802',
    '61802',
    'DIN 471',
    'DIN 472',
    'differential-Part.step',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Housing, gears, bearings and retention.' },
    {
      id: 'internals',
      label: 'Gears, bearings & rings',
      description: 'Inspect mechanical components without the housing.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Components separated along their actual port axes.',
    },
    {
      id: 'housing',
      label: 'Housing only',
      description: 'Source housing with corrected bearing seats and circlip grooves.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'internals', 'exploded', 'housing'].includes(state))
      errors.push('Choose a model state.');
    if (!['two', 'three'].includes(String(p.layout))) errors.push('Choose a port configuration.');
    if (![8, 10].includes(Number(p.bore))) errors.push('Select an 8 or 10 mm shaft interface.');
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  notes:
    'The user STEP supplies the 42 mm housing exterior and mounting pattern. Its three placeholder gears are replaced. Internal Ø21/Ø15 steps are recut for 15×24×5 bearings and DIN 471/472 retention. Bearing identity is inferred from the pictured Ø15/Ø24 and catalog dimensions; seller BOM is unavailable. Bore sizes, M1, 20 teeth, 1:1 and 15 mm gear length follow supplied images. Spiral tooth geometry, bearing internals, ring outlines, axial stack and fits are reconstructions. No verified tooth contact/load rating. The three-port version has coupled outputs, not differential action. Source STEP remains external; only the functional derived housing is bundled.',
  sources: [
    {
      label: 'Seller · 42 mm bevel gearbox',
      url: 'https://www.aliexpress.com/item/1005006771991196.html',
    },
    {
      label: 'SKF · series 618 dimensions',
      url: 'https://cdn.skfmediahub.skf.com/api/public/0901d19680237e2b/pdf_preview_medium/0901d19680237e2b_pdf_preview_medium.pdf',
    },
    { label: 'Rotor Clip DSH-15 · DIN 471', url: 'https://www.rotorclip.com/product/dsh-15/' },
    { label: 'Rotor Clip DHO-24 · DIN 472', url: 'https://www.rotorclip.com/product/dho-24/' },
  ],
};
export default part;
