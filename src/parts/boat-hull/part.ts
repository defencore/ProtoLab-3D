import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters, catalogSelection, updateParameters } from './configurator';
import presets from './presets.json';
import { pieces, stations, hulls } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'boat-hull',
  name: 'Boat hull',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'BOAT HULLS',
  icon: 'box',
  description:
    'Configurable monohulls, catamarans and trimarans with selectable bottom sections, bow and stern lines, asymmetry and bridge shapes.',
  complexity: 'Popular references · custom dimensions',
  keywords: [
    'boat',
    'ship',
    'hull',
    'catamaran',
    'trimaran',
    'flat bottom',
    'round bilge',
    'deadrise',
    'chine',
    'displacement',
    'planing',
    'pontoon',
    'canoe',
    'тримаран',
    'лодка',
    'USV',
    'Recoil',
    'DragonForce',
    '\u0441\u0443\u0434\u043d\u043e',
    '\u043a\u043e\u0440\u0430\u0431\u0435\u043b\u044c',
    '\u0447\u043e\u0432\u0435\u043d',
    '\u043a\u0430\u0442\u0430\u043c\u0430\u0440\u0430\u043d',
    '\u043a\u043e\u0440\u043f\u0443\u0441',
  ],
  defaults,
  parameters,
  updateParameters,
  presets: presets as Preset[],
  catalogSelection,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Separate major components for layout work.',
    },
    {
      id: 'body',
      label: 'Body only',
      description: 'Primary shell or plate without the remaining assembly.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate the major components for inspection.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'body', 'exploded'].includes(state))
      errors.push('Choose a valid model state.');
    const specs = hulls(p),
      lines = stations(p),
      wall = n(p, 'wall');
    for (const h of specs) {
      if (wall * 4 >= Math.min(h.beam, h.depth))
        errors.push('The wall inset is too large for this hull.');
      if (h.length <= h.beam * 1.5) errors.push('Each hull length must exceed 1.5 times its beam.');
      if (lines.some((s) => s.width * h.beam <= wall * 2))
        errors.push(
          'Bow or stern is too narrow for the wall inset; reduce the inset or widen the hull.',
        );
      if (lines.some((s) => s.depth * h.depth <= wall * 2))
        errors.push('End sections are too shallow for the wall inset.');
      if (
        ['v', 'double-chine'].includes(String(p.bottom)) &&
        lines.some(
          (s) =>
            ((s.width * h.beam * n(p, 'chineWidth')) / 200) *
              Math.tan((n(p, 'deadrise') * Math.PI) / 180) >=
            s.depth * h.depth * 0.9,
        )
      )
        errors.push(
          'Deadrise is too large for this beam and depth; deepen the hull or reduce the angle.',
        );
    }
    if (p.layout !== 'monohull') {
      const centre = p.layout === 'catamaran' ? 0 : n(p, 'centreBeam');
      if (n(p, 'beam') <= 2 * n(p, 'hullBeam') + centre + 4 * wall)
        errors.push('Overall beam must leave clearance between all hulls.');
      if (p.bridge !== 'none' && n(p, 'crossbeam') > n(p, 'length') * 0.06)
        errors.push('Crossbeam width must not exceed 6% of overall hull length.');
      if (
        ['raised', 'lowered'].includes(String(p.bridge)) &&
        n(p, 'bridgeCurve') > n(p, 'crossbeam') * 0.6
      )
        errors.push('Bridge rise or drop must not exceed 60% of its section height.');
    }
    return errors;
  },
  buildGeometry: (p, state) => assembly.geometry(pieces(p, state)),
  dimensions: (p, state) => assembly.dimensions(pieces(p, state)),
  python: (p, state) => assembly.python(pieces(p, state)),
  notes:
    'Geometric hull templates, not a buoyancy or planing prediction. X runs bow to stern, Y across the beam and Z upward. Z=0 is the midship sheer reference before sheer rise; it is not a waterline. Select flat, single/double-chine V, round, arched or soft-chine sections independently of the longitudinal hull form. Deadrise controls the symmetric parent section; asymmetric outer hulls shift the keel toward the tunnel. Rocker, sheer, maximum-beam station, stem and transom setbacks change the ruled hull lines. Wall inset is not constant normal thickness. Covers have 0.2 mm illustrative clearance; crossbeams clear the highest local sheer by 0.2 mm. These major solids omit hardware, sealed joints, propulsion, rudders, sailing rigs and keels. Branded presets verify only published length/beam; all other dimensions and contours are editable approximations.',
};
export default withParameterStates(part, {
  body: ['cover', 'bridge', 'crossbeam', 'bridgeCurve'],
});
