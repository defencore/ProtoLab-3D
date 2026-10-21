import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Shape, Vector2 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { extrude, n, num, numberParameter } from '../../core/geometry';
import { pythonWire, sectionBounds } from '../../core/mechanical';
import { retentionWasherSources } from './lib/catalog/retention-washers';

export function eRingOutline(p: Parameters): Vector2[] {
  const installedDiameter = n(p, 'installedGrooveDiameter');
  const R = n(p, 'outerDiameter') / 2,
    r = (installedDiameter > 0 ? installedDiameter : n(p, 'innerDiameter')) / 2,
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
      landRadius = installedDiameter > 0 ? r / Math.cos((distance * Math.PI) / 180) : r,
      radius = landRadius + (relief - landRadius) * smooth;
    points.push(
      new Vector2(
        radius * Math.cos((angle * Math.PI) / 180),
        radius * Math.sin((angle * Math.PI) / 180),
      ),
    );
  }
  points.push(new Vector2(-r * 1.08, R * 0.65));
  // Installed tangent lands contact the groove about the shaft axis. Stock rings
  // retain their original free contour and bounding-box-centred display datum.
  if (installedDiameter > 0)
    return points.filter((point, index) => {
      const incoming = point.clone().sub(points[(index + points.length - 1) % points.length]);
      const outgoing = points[(index + 1) % points.length].clone().sub(point);
      return Math.abs(incoming.cross(outgoing)) > 1e-10 || incoming.dot(outgoing) < 0;
    });
  const centerY = (Math.max(...points.map((p) => p.y)) + Math.min(...points.map((p) => p.y))) / 2;
  return points.map((p) => new Vector2(p.x, p.y - centerY));
}
const defaults = {
  grooveDiameter: 5,
  innerDiameter: 4.11,
  outerDiameter: 11.3,
  thickness: 0.7,
  tabAngle: 14,
  installedGrooveDiameter: 0,
};
const part: PartDefinition = {
  id: 'e-ring',
  product: productData as ProductProfile,
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
    {
      ...numberParameter(
        'installedGrooveDiameter',
        'Installed groove envelope',
        'Gᵢ',
        'Installation',
        0,
        50,
        0.1,
      ),
      filterable: false,
      visibleWhen: () => false,
      description:
        'Zero preserves the free ring. A positive nominal groove size centres an illustrative expanded three-lug envelope on the shaft axis; no machining of the purchased ring is prescribed.',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['grooveDiameter'],
  validate(p) {
    const errors: string[] = [];
    const installed = Number(p.installedGrooveDiameter);
    if (n(p, 'innerDiameter') >= n(p, 'grooveDiameter'))
      errors.push('The free contact diameter must be smaller than the nominal groove size.');
    if (n(p, 'innerDiameter') >= n(p, 'outerDiameter') * 0.55)
      errors.push('The contact lugs need room inside the outside envelope.');
    if (n(p, 'grooveDiameter') >= n(p, 'outerDiameter') * 0.8)
      errors.push('The nominal groove must leave retaining material outside the shaft.');
    if (!Number.isFinite(installed) || installed < 0)
      errors.push('The installed groove envelope must be zero or a finite positive diameter.');
    if (installed > 0) {
      if (Math.abs(installed - n(p, 'grooveDiameter')) > 1e-6)
        errors.push('The installed groove envelope must match the selected nominal groove size.');
      const transition = ((n(p, 'tabAngle') + 8) * Math.PI) / 180;
      if (installed / Math.cos(transition) >= n(p, 'outerDiameter') * 0.76)
        errors.push('The installed contact lands must leave two relief pockets inside the ring.');
    }
    return errors;
  },
  buildGeometry(p) {
    const points = eRingOutline(p),
      shape = new Shape(points);
    return new Group().add(extrude(shape, n(p, 'thickness')));
  },
  dimensions: (p) => [...sectionBounds(eRingOutline(p)), n(p, 'thickness')],
  python(p) {
    const source = `# Stamped three-lug reference outline. Elastic installation deformation is not modeled.\nshape=Part.Face(${pythonWire(eRingOutline(p), -n(p, 'thickness') / 2)}).extrude(App.Vector(0,0,${num(n(p, 'thickness'))}))`;
    if (n(p, 'installedGrooveDiameter') === 0) return source;
    return `${source}\ncomponent_metadata=[${JSON.stringify({ InstalledGrooveEnvelope: `Illustrative expanded three-lug envelope on a ${n(p, 'installedGrooveDiameter')} mm nominal groove, centred on the shaft axis. No machining of the purchased DIN 6799 ring is prescribed. Free source dimensions remain unchanged; actual deformation, groove tolerances and retention require supplier drawing and physical fit approval.` })}]`;
  },
  notes:
    'The supplier verifies DIN6799 nominal groove size. REYHER supplies the maximum outside envelope and thickness reference; American Ring supplies the free contact diameter reference. Lug angles and relief curves are representative. Zero installed groove envelope preserves the stock free profile and display datum. A positive value centres an illustrative expanded three-lug contour on the shaft axis with tangent contact lands at the nominal groove; it does not prescribe machining a purchased ring or alter its free product dimensions. Actual elastic deformation, groove tolerances and retention capacity are not simulated.',
  sources: [
    {
      label: 'American Ring DIN6799 dimensions and three-lug drawing',
      url: retentionWasherSources.ring,
    },
    { label: 'REYHER DIN6799 outside envelopes · page100', url: retentionWasherSources.envelope },
  ],
};
export default { ...part, presets: modulePresets };
