import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import { geometry, python, dimensions } from './lib/model';
import presets from './presets.json';
const source = 'https://www.hiwonder.com/products/suspended-shock-absorbing-tracked-chassis';
const part: PartDefinition = {
  id: 'tracked-chassis',
  name: 'Suspended tracked chassis',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'GROUND VEHICLES',
  icon: 'wheel',
  complexity: 'Source dimensions · reconstructed suspension',
  description:
    'Hiwonder-style robot chassis with single or double decks, independently posed left/right trailing-arm suspension, eight tension springs, adjustable idlers and two geared motors.',
  keywords: [
    'Hiwonder',
    'tank',
    'robot',
    'crawler',
    'tracks',
    'suspension',
    '21030156',
    'JGB3865',
    'tracked chassis',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Complete chassis',
      description: 'Decks, drive modules, suspension and tracks.',
    },
    {
      id: 'undercarriage',
      label: 'Without tracks',
      description: 'Inspect the suspension arms, springs, axles and wheel bearings.',
    },
    {
      id: 'exploded',
      label: 'Exploded assembly',
      description: 'Decks lift up; left and right running gear move outboard.',
    },
    {
      id: 'frame',
      label: 'Frame and decks',
      description: 'Mounting plates and optional upper deck with spacers.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!Number.isInteger(+p.roadCount)) errors.push('Road wheel count must be a whole number.');
    if (!['assembled', 'undercarriage', 'exploded', 'frame'].includes(state))
      errors.push('Select a chassis view.');
    if (+p.width - 2 * +p.trackWidth < +p.deckWidth + 2)
      errors.push('Overall width must leave at least 1 mm between each track and the deck.');
    if (+p.deckWidth - 20 - 2 * +p.plateThickness < 100)
      errors.push('The frame must fit both geared motors.');
    const end = +p.length / 2 - +p.driveDiameter / 2 - 6.05;
    const R = +p.driveDiameter / 2,
      r = +p.roadDiameter / 2;
    const clearance = Math.sqrt(Math.max(0, (R + r + 2) ** 2 - (R + 16 - r - 6.05 - 3) ** 2)) + 3;
    if ((2 * end - 2 * clearance) / (+p.roadCount - 1) < Math.max(+p.roadDiameter + 5, 36))
      errors.push(
        'Increase chassis length or reduce the road wheel count/diameter to leave clearance between wheels.',
      );
    if (+p.driveDiameter * 0.5 + 22 < +p.roadDiameter * 0.5 + 24)
      errors.push('End wheels must leave room above the suspension.');
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  notes:
    'Hiwonder publishes 270 × 194 mm chassis dimensions, a 270 × 143 × 2 mm deck, single/double deck versions, eight tension-spring suspension modules and the JGB3865-520R45-12 motor drawing. Wheel, spring, bearing, bracket, shaft-fit and slot coordinates are reconstructed for layout, not manufacturer CAD. The 4×10×4 and 6×12×4 bearing envelopes are modelling choices, not a verified Hiwonder BOM. Belts are two connected solids with integral tread ribs; they follow the posed wheel envelope but do not simulate articulated links, chain pitch engagement or elastic tension. Suspension angles pose all arms on each side together. Lightweight mode substitutes smooth belts and central spring envelopes. Dimensions are editable prototype dimensions; modified presets no longer describe the stock product.',
  sources: [{ label: 'Hiwonder · suspended shock-absorbing tracked chassis', url: source }],
};
export default part;
