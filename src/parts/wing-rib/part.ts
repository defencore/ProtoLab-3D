import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import presets from './presets.json';
import { defaults, parameters, catalogSelection } from './configurator';
import { inside, polygonGap, section, geometry, python, dimensions, dxf } from './lib/model';

const part: PartDefinition = {
  id: 'wing-rib',
  name: 'Wing rib',
  product: product as ProductProfile,
  category: 'VEHICLE STRUCTURES',
  subgroup: 'AIRFRAME STRUCTURE',
  icon: 'wing',
  description:
    'Cut-sheet NACA wing ribs with two fitted spar slots, retained cutout webs and a trimmed trailing tip.',
  complexity: 'Parametric sheet detail',
  keywords: [
    'wing',
    'rib',
    'airfoil',
    'NACA',
    'balsa',
    'plywood',
    'laser',
    'spar',
    'aircraft',
    'fixed wing',
  ],
  defaults,
  parameters,
  catalogSelection,
  presets: presets as Preset[],
  presetMatchKeys: ['profile', 'chord', 'thickness'],
  states: [
    {
      id: 'flat',
      label: 'Flat blank',
      description: 'One sheet rib in its cutting plane; Z is the stock thickness.',
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
        errors.push(`Choose a valid ${field.label.toLowerCase()}.`);
      if (field.type === 'boolean' && typeof v !== 'boolean')
        errors.push(`${field.label} must be enabled or disabled.`);
    }
    if (errors.length) return errors;
    if (Number(p.tailTrim) >= Number(p.chord) * 0.15)
      errors.push('Trailing edge cutback must be less than 15% of chord.');
    const s = section(p),
      web = Number(p.minimumWeb);
    for (const [i, slot] of s.slots.entries()) {
      if (slot.some((v) => !inside(v, s.outline)) || polygonGap(slot, s.outline) < web - 1e-6)
        errors.push(
          `${i === 0 ? 'Main' : 'Rear'} spar slot must retain the minimum web to the airfoil boundary.`,
        );
    }
    if (s.slots.length === 2 && s.slots[1][0][0] - s.slots[0][1][0] < web)
      errors.push('Spar slots must remain separate with the minimum web between them.');
    const tail = s.outline.filter(
      (v) => Math.abs(v[0] - (Number(p.chord) - Number(p.tailTrim))) < 1e-8,
    );
    if (tail.length !== 2 || Math.abs(tail[0][1] - tail[1][1]) < 1)
      errors.push('Increase the trailing edge cutback to leave a cut edge at least 1 mm high.');
    if (s.circles.some((c) => c.radius < 1))
      errors.push(
        'Lightening bays must fit holes of at least 2 mm diameter while retaining the minimum web.',
      );
    if (
      s.circles.length === 2 &&
      Math.hypot(
        s.circles[0].center[0] - s.circles[1].center[0],
        s.circles[0].center[1] - s.circles[1].center[1],
      ) -
        s.circles[0].radius -
        s.circles[1].radius <
        web
    )
      errors.push('Lightening holes must retain the minimum web between them.');
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  fabricationFiles: (p) => [
    {
      id: 'cutting',
      label: 'Rib cutting profile (DXF)',
      description:
        'Millimetres, closed unoffset section and spar contours; circular lightening holes. Apply tool compensation in CAM.',
      name: 'wing-rib.dxf',
      type: 'application/dxf',
      content: dxf(p),
    },
  ],
  notes:
    'Select actual balsa, plywood or composite sheet and verify grain, sheet thickness and bonding. Slots are enclosed through cuts centered on the section camber line; clearance is total dimensional allowance, not a per-side fit. Laser cutting suits appropriate wood stock; use a suitable milling route for composite sheet. Rectangular spar slots require a square-corner process or manual corner relief. Minimum web is a geometric cutout check, not a load rating. The finite trailing tip is removed for a separate trailing edge strip. Define rib spacing, spar load path, skin and attachment joints before flight.',
  sources: [
    {
      label: 'NASA: NACA airfoil section nomenclature',
      url: 'https://www.nasa.gov/image-article/naca-airfoils/',
    },
    {
      label: 'NASA TM X-3284: four-digit airfoil ordinates',
      url: 'https://ntrs.nasa.gov/citations/19760003945',
    },
  ],
};
export default part;
