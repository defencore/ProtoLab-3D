import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters, catalogSelection } from './configurator';
import {
  section,
  inside,
  boundaryDistance,
  polygonGap,
  geometry,
  python,
  dimensions,
  dxf,
} from './lib/model';

const part: PartDefinition = {
  id: 'fuselage-bulkhead',
  name: 'Fuselage former',
  product: product as ProductProfile,
  category: 'VEHICLE STRUCTURES',
  subgroup: 'AIRFRAME STRUCTURE',
  icon: 'wing',
  description:
    'Cut-sheet round, elliptic and box formers with stringer seats, a service opening and optional mounting holes.',
  complexity: 'Parametric sheet detail',
  keywords: [
    'fuselage',
    'bulkhead',
    'former',
    'frame',
    'aircraft',
    'stringer',
    'plywood',
    'balsa',
    'laser',
    'fixed wing',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['form', 'width', 'height', 'thickness'],
  states: [
    {
      id: 'flat',
      label: 'Flat blank',
      description: 'One former in its cutting plane; Z is the stock thickness.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (state !== 'flat') errors.push('Choose the flat blank state.');
    for (const field of parameters) {
      const v = p[field.key];
      if (
        field.type === 'number' &&
        (typeof v !== 'number' || !Number.isFinite(v) || v < field.min! || v > field.max!)
      )
        errors.push(`${field.label} is outside its finite range.`);
      if (field.type === 'select' && !field.options!.some((o) => o.value === v))
        errors.push('Choose a round, elliptic or box former.');
      if (field.type === 'boolean' && typeof v !== 'boolean')
        errors.push(`${field.label} must be enabled or disabled.`);
    }
    if (errors.length) return errors;
    const rx = Number(p.width) / 2,
      ry = (p.form === 'round' ? Number(p.width) : Number(p.height)) / 2,
      web = Number(p.minimumWeb);
    if (p.form === 'round' && Number(p.height) !== Number(p.width))
      errors.push('A round former must have equal width and height.');
    if (
      p.notches &&
      (Number(p.notchWidth) >= Math.min(rx, ry) || Number(p.notchDepth) + web >= Math.min(rx, ry))
    )
      errors.push('Stringer notches must fit within one side and leave a central load path.');
    if (p.notches && p.form !== 'box') {
      const w = Number(p.notchWidth) / 2,
        depth = Number(p.notchDepth);
      if (
        depth <=
        Math.max(rx * (1 - Math.sqrt(1 - (w / ry) ** 2)), ry * (1 - Math.sqrt(1 - (w / rx) ** 2)))
      )
        errors.push('Stringer notch depth must extend inside the curved outer edge.');
    }
    if (p.mountingHoles && Number(p.mountingInset) >= Math.min(rx, ry) - web)
      errors.push('Mounting ellipse inset must leave four distinct hole centres.');
    if (errors.length) return errors;
    const s = section(p);
    if (s.opening) {
      if (
        s.opening.some((v) => !inside(v, s.outline)) ||
        polygonGap(s.opening, s.outline) < web - 1e-6
      )
        errors.push(
          'The service opening must retain the minimum web to the outer edge and all stringer notches.',
        );
    }
    for (const c of s.circles) {
      if (
        !inside(c.center, s.outline) ||
        boundaryDistance(c.center, s.outline) - c.radius < web - 1e-6 ||
        (s.opening &&
          (inside(c.center, s.opening) ||
            boundaryDistance(c.center, s.opening) - c.radius < web - 1e-6))
      )
        errors.push(
          'Mounting holes must retain the minimum web to the service opening, notches and outside edge.',
        );
    }
    for (let i = 0; i < s.circles.length; i++)
      for (let j = i + 1; j < s.circles.length; j++) {
        const a = s.circles[i],
          b = s.circles[j];
        if (
          Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) - a.radius - b.radius <
          web
        )
          errors.push('Mounting holes must remain separate with the minimum web.');
      }
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  updateParameters(p, key) {
    const next = { ...p };
    if (next.form === 'round' && (key === 'form' || key === 'width')) next.height = next.width;
    return next;
  },
  fabricationFiles: (p) => [
    {
      id: 'cutting',
      label: 'Former cutting profile (DXF)',
      description:
        'Millimetres, closed unoffset contours with notches and service window; analytic mounting circles. Apply tool compensation in CAM.',
      name: 'fuselage-former.dxf',
      type: 'application/dxf',
      content: dxf(p),
    },
  ],
  notes:
    'Choose actual plywood, balsa or composite sheet; specify thickness, grain or laminate orientation, adhesive and edge finish. Notches locate four longitudinal stringers at the outside extrema; their depth is measured from the overall width or height extremum. Optional diagonal holes are custom attachment points, not a commercial mounting standard. Outline and service ellipses are closed polylines with maximum nominal radial chord error below 0.011 mm at the 600 mm size limit. Use a wood-compatible cutting process or mill composite stock; rectangular seats need square-corner cutting or manual corner relief. Minimum web is a geometric spacing check and does not establish airframe strength or joint capacity.',
  sources: [],
};
export default part;
