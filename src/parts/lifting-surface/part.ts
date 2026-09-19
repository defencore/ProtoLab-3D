import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import { geometry, dimensions, python } from './lib/geometry';
import { profileDefinition } from './lib/profiles';
import presets from './presets.json';

const part: PartDefinition = {
  id: 'lifting-surface',
  name: 'Wing and control surface',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'WINGS & CONTROL SURFACES',
  icon: 'wing',
  complexity: 'Spanwise profiles · sweep, taper, twist and mirrored panels',
  description:
    'Configurable wings, canards, fins, rudders and hydrofoils with NACA, double-wedge or biconvex profiles. Build and inspect geometric concepts for air or water.',
  keywords: [
    'wing',
    'canard',
    'fin',
    'rudder',
    'hydrofoil',
    'airfoil',
    'foil',
    'NACA',
    'subsonic',
    'supersonic',
    'aircraft',
    'rocket',
    'boat',
    'marine',
    'delta',
    'swept',
    'wings',
    'control surface',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'surface',
      label: 'Complete surface',
      description: 'Solid panel or mirrored pair, including sweep, dihedral and twist.',
    },
    {
      id: 'root-section',
      label: 'Root profile',
      description: 'Unrotated root cross-section extruded to the sample depth.',
    },
    {
      id: 'tip-section',
      label: 'Tip profile',
      description: 'Unrotated tip cross-section extruded to the sample depth.',
    },
  ],
  validate(p) {
    const errors: string[] = [];
    for (const key of ['spanSegments', 'profileSegments'])
      if (!Number.isInteger(n(p, key))) errors.push('Model divisions must be whole numbers.');
    const minChord = Math.min(
      n(p, 'rootChord'),
      n(p, 'tipChord'),
      p.planform === 'cranked' ? n(p, 'kinkChord') : Infinity,
    );
    const minThickness = Math.min(
      profileDefinition(p, 'root').thickness,
      profileDefinition(p, 'tip').thickness,
    );
    if (n(p, 'trailingEdge') >= minChord * minThickness)
      errors.push('The trailing edge must remain thinner than the thinnest section.');
    if (Math.abs(n(p, 'incidence') + n(p, 'twist')) > 60)
      errors.push('Keep the total tip incidence within ±60°.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  notes:
    'E387, S1223 and NACA 23012 use UIUC tabulated coordinates with linear interpolation. Each surface is normalized from its shared leftmost sample to its trailing edge; the line from that sample to each trailing-edge endpoint is subtracted to close the trailing edge. This explicitly modifies finite-gap source profiles; user edge thickness is additive. Geometric concept models, not aerodynamic, hydrodynamic or structural qualification. NACA sections use the closed trailing-edge coefficient −0.1036; a nonzero trailing-edge thickness further modifies the profile. Double-wedge and biconvex sections represent sharp-edge profile families often studied for supersonic flow, without a certified speed range. Root/tip profiles are linearly blended in normalized coordinates. Sweep is measured at quarter chord; incidence and twist rotate about local quarter chord. X runs toward the trailing edge, Y along span and Z upward; vertical orientation rotates the complete geometry about X. Dihedral offsets section centres without changing their chord planes. Elliptic taper retains a finite tip. Native CAD uses ruled lofts of sampled polygonal sections; increasing divisions improves geometric resolution. No spars, hinges, mounts, materials, lift/drag, stall, flutter, cavitation or strength calculations are supplied. Presets are editable examples, not proven aircraft or marine components.',
  sources: [
    {
      label: 'UIUC \u00b7 E387',
      url: 'https://m-selig.ae.illinois.edu/ads/coord_seligFmt/e387.dat',
    },
    {
      label: 'UIUC \u00b7 S1223',
      url: 'https://m-selig.ae.illinois.edu/ads/coord_seligFmt/s1223.dat',
    },
    {
      label: 'UIUC \u00b7 NACA 23012  12%',
      url: 'https://m-selig.ae.illinois.edu/ads/coord_seligFmt/naca23012.dat',
    },
    {
      label: 'NASA OpenVSP · profile families and geometric controls',
      url: 'https://www.nasa.gov/reference/openvsp-cross-sections/',
    },
    {
      label: 'PDAS · NACA four-digit thickness equation (standard finite trailing edge)',
      url: 'https://www.pdas.com/naca456thick4.html',
    },
  ],
};
export default withParameterStates(part, {
  'root-section': [
    'layout',
    'orientation',
    'planform',
    'semiSpan',
    'tipChord',
    'rootGap',
    'sweep',
    'dihedral',
    'incidence',
    'twist',
    'tipProfile',
    'spanSegments',
  ],
  'tip-section': [
    'layout',
    'orientation',
    'planform',
    'semiSpan',
    'rootChord',
    'rootGap',
    'sweep',
    'dihedral',
    'incidence',
    'twist',
    'rootProfile',
    'spanSegments',
  ],
});
