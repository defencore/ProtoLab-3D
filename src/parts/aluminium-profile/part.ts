import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters, profileDefaults, type ProfileId } from './configurator';
import { aluminiumProfileReferenceFiles } from './lib/catalog';
import { buildProfile, profilePython } from './lib/geometry';
import { validateProfile } from './lib/validation';
import presetData from './presets.json';

const part: PartDefinition = {
  id: 'aluminium-profile',
  name: 'T-slot aluminium profile',
  category: 'STRUCTURAL PARTS',
  subgroup: 'ALUMINIUM PROFILES',
  icon: 'rail',
  complexity: '8 cross sections · open slots and longitudinal cavities',
  description:
    'Low EU profiles, four-face framing extrusions and a twin-side-slot H profile with editable cut length and cross-section dimensions.',
  keywords: [
    'aluminium',
    'aluminum',
    'extrusion',
    'profile',
    'T-slot',
    'EU1020',
    'EU1030',
    'EU1040',
    'EU1050',
    '2020',
    '2040',
    'GB1020H',
    '1540',
    '40x15',
    'rail',
    'frame',
    'CNC',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['profile', 'length'],
  validate: validateProfile,
  buildGeometry: buildProfile,
  python: profilePython,
  dimensions: (p) => [n(p, 'width'), n(p, 'height'), n(p, 'length')],
  updateParameters(p, key) {
    return key === 'profile' ? profileDefaults(p.profile as ProfileId, n(p, 'length')) : p;
  },
  notes:
    'Straight extruded cross sections from the supplied reference drawings. Open T/C slots and internal bores run through the entire cut length. Dimensioned sizes are retained in reference metadata; unlisted cavity dimensions, bore positions, small radii and step details are editable prototype settings. EU1030 measures 29.8 × 9.9 mm. EU1540 is a descriptive label for the 40 × 15 mm drawing. Listed cut lengths 50–550 mm apply only to EU1020/1030/1040/1050. Other initial lengths are prototype choices. Supplier mass per metre is recorded without inferring alloy, strength, extrusion tolerances or production fit.',
  sources: Object.entries(aluminiumProfileReferenceFiles).map(([label, url]) => ({
    label: `Supplied aluminium profile reference · ${label}`,
    url,
  })),
};
export default part;
