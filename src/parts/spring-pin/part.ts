import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { n, numberParameter } from '../../core/geometry';
import { annularSector, loftMesh, pythonWire, sectionBounds } from '../../core/mechanical';

function values(p: Parameters, state: string) {
  const radius = (n(p, 'diameter') + (state === 'free' ? n(p, 'oversize') : 0)) / 2;
  const gap = state === 'free' ? n(p, 'slotAngle') : n(p, 'installedSlotAngle');
  const length = n(p, 'length'),
    wall = n(p, 'wall'),
    chamfer = n(p, 'chamfer');
  const sections = [-length / 2, -length / 2 + chamfer, length / 2 - chamfer, length / 2].map(
    (z, i) => ({
      z,
      points: annularSector(radius - (i === 0 || i === 3 ? wall * 0.35 : 0), radius - wall, gap),
    }),
  );
  return { radius, length, wall, chamfer, gap, sections };
}

const defaults = {
  diameter: 4,
  oversize: 0.4,
  length: 20,
  wall: 0.8,
  slotAngle: 32,
  installedSlotAngle: 8,
  chamfer: 0.75,
};
const part: PartDefinition = {
  id: 'spring-pin',
  name: 'Slotted spring pin',
  category: 'FASTENERS',
  subgroup: 'PINS & DOWELS',
  icon: 'bolt',
  complexity: 'Slotted tube',
  standard: 'DIN 1481 reference',
  description: 'A split tubular pin with chamfered ends and free or installed envelopes.',
  keywords: ['spring', 'roll pin', 'split pin', 'dowel', 'DIN 1481', 'ISO 8752', 'slotted'],
  parameters: [
    numberParameter('diameter', 'Nominal fit diameter', 'd', 'Body', 1, 35),
    numberParameter('length', 'Length', 'L', 'Body', 4, 250),
    numberParameter('wall', 'Wall thickness', 's', 'Body', 0.15, 8),
    numberParameter('oversize', 'Free diameter oversize', 'Δd', 'Fit & slit', 0, 2),
    { ...numberParameter('slotAngle', 'Free slit angle', 'α', 'Fit & slit', 5, 80, 1), unit: '°' },
    {
      ...numberParameter('installedSlotAngle', 'Installed slit angle', 'β', 'Fit & slit', 1, 40, 1),
      unit: '°',
    },
    numberParameter('chamfer', 'End chamfer length', 'a', 'Ends', 0.1, 5),
  ],
  presetMatchKeys: ['diameter', 'length'],
  defaults,
  presets: modulePresets,
  states: [
    { id: 'free', label: 'Free', description: 'Oversized pin before insertion.' },
    {
      id: 'installed',
      label: 'Installed',
      description: 'Nominal bore envelope with the specified residual slit.',
    },
  ],
  validate(p, state) {
    const { radius, wall, length, chamfer } = values(p, state);
    const errors: string[] = [];
    if (wall >= n(p, 'diameter') / 2)
      errors.push('Wall thickness must leave a hollow bore in the installed pin.');
    if (chamfer * 2 >= length) errors.push('The two end chamfers must fit within the pin length.');
    if (n(p, 'installedSlotAngle') > n(p, 'slotAngle'))
      errors.push('The installed slit cannot be wider than the free slit.');
    if (radius - wall <= 0) errors.push('The pin needs a positive bore radius.');
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group();
    group.add(loftMesh(values(p, state).sections));
    return group;
  },
  python(p, state) {
    return `sections = [${values(p, state)
      .sections.map((section) => pythonWire(section.points, section.z))
      .join(',\n')} ]\nshape = Part.makeLoft(sections, True, True).removeSplitter()`;
  },
  dimensions(p, state) {
    const v = values(p, state);
    return [...sectionBounds(v.sections[1].points), v.length];
  },
  notes:
    'Nominal diameter, wall and chamfer ranges follow the linked supplier drawing. Slit angles are editable prototype choices. Free and installed states are geometric envelopes, not a press-fit force simulation. Curved surfaces are polygonal in both exports.',
  sources: [
    {
      label: 'Gvyntok · DIN 1481 dimensional drawing',
      url: 'https://gvyntok.com/wp-content/uploads/2024/06/080-080-001.pdf',
    },
    {
      label: 'Gvyntok · Ø10 × 32 product',
      url: 'https://gvyntok.com/uk/shop/shplinty-i-strubtsiny/shtifti-pruzhinni-trubchasti-din-1481-bez-pokrittya/shtift-pruzhinnij-din-1481-bez-pokrittya-m10h32/',
    },
  ],
};
export default { ...part, presets: modulePresets };
