import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import {
  dxf,
  featureEdgeDistance,
  geometry,
  plateLayout,
  python,
  segmentDistance,
  slotEndpoints,
} from './lib/model';
const part: PartDefinition = {
  id: 'vehicle-mounting-plate',
  name: 'Vehicle payload and electronics plate',
  product: profile as ProductProfile,
  category: 'VEHICLE STRUCTURES',
  subgroup: 'VEHICLE MOUNTS',
  icon: 'bracket',
  complexity: 'Cut and drilled flat detail',
  description:
    'Flat payload, battery and electronics trays with controlled hole patterns, perimeter mounting and rounded strap slots.',
  keywords: [
    'payload tray',
    'battery tray',
    'flight controller',
    'electronics plate',
    'strap',
    'carbon plate',
    'rover',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  presetMatchKeys: ['length', 'width', 'thickness', 'pattern', 'straps'],
  states: [
    {
      id: 'default',
      label: 'Flat plate',
      description: 'Bottom face at Z = 0; cut geometry is already flat.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (state !== 'default') errors.push('Choose the flat plate state.');
    if (!['none', '20', '30.5', 'dual', 'custom'].includes(String(p.pattern)))
      errors.push('Choose a supported hole pattern.');
    if (typeof p.straps !== 'boolean' || typeof p.perimeter !== 'boolean')
      errors.push('Choose the strap-slot and perimeter-hole options.');
    if (
      parameters.some(
        (f) =>
          f.type === 'number' &&
          (!Number.isFinite(Number(p[f.key])) ||
            Number(p[f.key]) < f.min! ||
            Number(p[f.key]) > f.max!),
      )
    )
      return [...errors, 'Plate dimensions are outside the supported finite ranges.'];
    if (2 * Number(p.corner) >= Math.min(Number(p.length), Number(p.width)))
      errors.push('Corner chamfers must leave a straight side on the blank.');
    if (
      p.perimeter &&
      (Number(p.edgeOffset) < 2 * Number(p.hole) ||
        2 * Number(p.edgeOffset) >= Math.min(Number(p.length), Number(p.width)))
    )
      errors.push(
        'Perimeter holes need an edge offset of at least two hole diameters and a positive rectangular pitch.',
      );
    if (p.straps && Number(p.strapLength) <= Number(p.strapWidth))
      errors.push('Strap slot length must exceed its width.');
    const v = plateLayout(p),
      web = 2;
    if (v.holes.some((q) => featureEdgeDistance(v.outline, [q], v.d / 2) < web - 1e-6))
      errors.push(
        'Each hole must retain at least 2 mm of material to the finished outline, including the chamfered corners.',
      );
    if (
      v.slots.some(
        (s) => featureEdgeDistance(v.outline, slotEndpoints(s), s.width / 2) < web - 1e-6,
      )
    )
      errors.push('Each strap slot must retain at least 2 mm of material to the finished outline.');
    if (
      v.holes.some((a, i) =>
        v.holes.slice(i + 1).some((b) => Math.hypot(a[0] - b[0], a[1] - b[1]) - v.d < web - 1e-6),
      )
    )
      errors.push('Mounting holes must retain at least 2 mm of material between their edges.');
    if (
      v.slots.some((s) => {
        const [a, b] = slotEndpoints(s);
        return v.holes.some((q) => segmentDistance(a, b, q) - s.width / 2 - v.d / 2 < web - 1e-6);
      })
    )
      errors.push(
        'Move the strap slots or mounting holes to leave at least 2 mm between their edges.',
      );
    if (
      v.slots.some((s, i) =>
        v.slots.slice(i + 1).some((q) => {
          const [a, b] = slotEndpoints(s),
            [c, d] = slotEndpoints(q);
          return (
            Math.min(
              segmentDistance(a, b, c),
              segmentDistance(a, b, d),
              segmentDistance(c, d, a),
              segmentDistance(c, d, b),
            ) -
              (s.width + q.width) / 2 <
            web - 1e-6
          );
        }),
      )
    )
      errors.push('Strap slots must retain at least 2 mm of material between their edges.');
    return errors;
  },
  buildGeometry: (p) => geometry(p),
  buildExportGeometry: (p) => geometry(p, true),
  python,
  dimensions: (p) => [Number(p.length), Number(p.width), Number(p.thickness)],
  assessment(p) {
    const v = plateLayout(p);
    return [
      `${v.L} x ${v.W} x ${p.thickness} mm flat blank; ${v.holes.length} holes, diameter ${p.hole} mm; ${v.slots.length} rounded strap slots.`,
      'Hole patterns are authored geometric interfaces. Verify the actual payload drawing, fastener heads and connector access before cutting.',
      'Choose stock and qualify bending, strap restraint and vehicle vibration. Minimum geometric webs do not establish a load rating.',
    ];
  },
  fabricationFiles(p: Parameters) {
    return [
      {
        id: 'flat-pattern',
        label: 'Flat cutting and drilling drawing',
        description: 'Millimetres · exact slot arcs and hole circles · no cutter compensation',
        name: 'vehicle-mounting-plate.dxf',
        type: 'application/dxf',
        content: dxf(p),
      },
    ];
  },
  validationNotice:
    'Authored flat plate: select stock and qualify the payload and restraint loads.',
  notes:
    'The 20 mm and 30.5 mm square patterns are configurable geometric choices, not supplier-certified CAD. The DXF has separate OUTLINE, HOLES and STRAP_SLOTS layers and no cutter compensation. Deburr and finish edges for straps. No straps, fasteners, spacers or payload are included.',
  sources: [],
};
export default part;
