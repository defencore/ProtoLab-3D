import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Shape, Vector2 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { extrude, n, num, numberParameter } from '../../core/geometry';
import { pythonWire, sectionBounds } from '../../core/mechanical';
import { retentionWasherSources } from './lib/catalog/retention-washers';

export function eRingOutline(p: Parameters): Vector2[] {
  const R = n(p, 'outerDiameter') / 2,
    r = n(p, 'innerDiameter') / 2,
    tab = n(p, 'tabAngle'),
    relief = R * 0.76;
  const points: Vector2[] = [];
  // The open top and three inner contact lands form the characteristic stamped E profile.
  for (let angle = 125; angle <= 415; angle++)
    points.push(
      new Vector2(R * Math.cos((angle * Math.PI) / 180), R * Math.sin((angle * Math.PI) / 180)),
    );
  points.push(new Vector2(r * 1.08, R * 0.65), new Vector2(r, 0));
  for (let angle = -1; angle >= -180; angle--) {
    const distance = Math.min(Math.abs(angle), Math.abs(angle + 90), Math.abs(angle + 180));
    const t = Math.max(0, Math.min(1, (distance - tab) / 8)),
      smooth = t * t * (3 - 2 * t),
      radius = r + (relief - r) * smooth;
    points.push(
      new Vector2(
        radius * Math.cos((angle * Math.PI) / 180),
        radius * Math.sin((angle * Math.PI) / 180),
      ),
    );
  }
  points.push(new Vector2(-r * 1.08, R * 0.65));
  const centerY = (Math.max(...points.map((p) => p.y)) + Math.min(...points.map((p) => p.y))) / 2;
  return points.map((p) => new Vector2(p.x, p.y - centerY));
}
const defaults = {
  grooveDiameter: 5,
  innerDiameter: 4.11,
  outerDiameter: 11.3,
  thickness: 0.7,
  tabAngle: 14,
};
const part: PartDefinition = {
  id: 'e-ring',
  name: 'E-type retaining ring',
  category: 'FASTENERS & THREADS',
  subgroup: 'RETAINING RINGS',
  icon: 'bearing',
  complexity: 'Stamped open profile',
  standard: 'DIN 6799 reference',
  description:
    'A radially installed E-shaped retaining washer with three contact lugs and two relief pockets.',
  keywords: ['E clip', 'E-ring', 'retaining', 'three lug', 'shaft', 'DIN 6799', 'radial'],
  defaults,
  parameters: [
    {
      ...numberParameter(
        'grooveDiameter',
        'Nominal groove size',
        'G',
        'Identification',
        0.5,
        50,
        0.1,
      ),
      description:
        'The DIN6799 nominal ring size identifies its shaft groove; it is not the full shaft diameter.',
    },
    {
      ...numberParameter(
        'innerDiameter',
        'Free contact diameter',
        'D',
        'Ring profile',
        0.3,
        50,
        0.01,
      ),
      description: 'Reference diameter through the three inner contact lands before installation.',
    },
    {
      ...numberParameter('outerDiameter', 'Outside envelope', 'd₃', 'Ring profile', 1, 100, 0.1),
      description: 'Maximum reference outside envelope; not a measured supplier product.',
    },
    numberParameter('thickness', 'Thickness', 's', 'Ring profile', 0.1, 8, 0.05),
    {
      ...numberParameter('tabAngle', 'Contact half-angle', 'α', 'Lug shape', 8, 25, 1),
      unit: '°',
      description: 'Representative lug and relief transitions; not dimensioned by the supplier.',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['grooveDiameter'],
  validate(p) {
    const errors: string[] = [];
    if (n(p, 'innerDiameter') >= n(p, 'grooveDiameter'))
      errors.push('The free contact diameter must be smaller than the nominal groove size.');
    if (n(p, 'innerDiameter') >= n(p, 'outerDiameter') * 0.55)
      errors.push('The contact lugs need room inside the outside envelope.');
    if (n(p, 'grooveDiameter') >= n(p, 'outerDiameter') * 0.8)
      errors.push('The nominal groove must leave retaining material outside the shaft.');
    return errors;
  },
  buildGeometry(p) {
    const points = eRingOutline(p),
      shape = new Shape(points);
    return new Group().add(extrude(shape, n(p, 'thickness')));
  },
  dimensions: (p) => [...sectionBounds(eRingOutline(p)), n(p, 'thickness')],
  python(p) {
    return `# Stamped three-lug reference outline. Elastic installation deformation is not modeled.\nshape=Part.Face(${pythonWire(eRingOutline(p), -n(p, 'thickness') / 2)}).extrude(App.Vector(0,0,${num(n(p, 'thickness'))}))`;
  },
  notes:
    'The supplier verifies DIN6799 nominal groove size. REYHER supplies the maximum outside envelope and thickness reference; American Ring supplies the free contact diameter reference. Lug angles and relief curves are representative. The resulting outline combines a free contact opening with the maximum outside fit envelope; installed elastic deformation, groove tolerances and retention capacity are not simulated.',
  sources: [
    {
      label: 'American Ring DIN6799 dimensions and three-lug drawing',
      url: retentionWasherSources.ring,
    },
    { label: 'REYHER DIN6799 outside envelopes · page100', url: retentionWasherSources.envelope },
  ],
};
export default { ...part, presets: modulePresets };
