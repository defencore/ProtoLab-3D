import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { BoundaryMesh } from '../../core/mechanical';
import { retentionWasherSources } from './lib/catalog/retention-washers';

export function lockWasherSections(p: Parameters, state: string) {
  const r = n(p, 'innerDiameter') / 2,
    R = n(p, 'outerDiameter') / 2,
    s = n(p, 'thickness');
  const start = (n(p, 'gapAngle') * Math.PI) / 360,
    end = Math.PI * 2 - start,
    rise = state === 'flattened' ? 0 : n(p, 'freeHeight') - s;
  const angles = Array.from({ length: 97 }, (_, i) => start + ((end - start) * i) / 96);
  for (const a of [Math.PI / 2, Math.PI, Math.PI * 1.5]) if (a > start && a < end) angles.push(a);
  angles.sort((a, b) => a - b);
  return angles
    .filter((a, i) => i === 0 || a - angles[i - 1] > 1e-9)
    .map((a) => {
      const z = rise * ((a - start) / (end - start) - 0.5);
      return [
        [r, z - s / 2],
        [r, z + s / 2],
        [R, z + s / 2],
        [R, z - s / 2],
      ].map(([radius, z]) => new Vector3(radius * Math.cos(a), radius * Math.sin(a), z));
    });
}
const defaults = {
  diameter: 8,
  innerDiameter: 8.5,
  outerDiameter: 14.8,
  thickness: 2.1,
  freeHeight: 4.7,
  gapAngle: 8,
};
const part: PartDefinition = {
  id: 'split-lock-washer',
  name: 'Split spring lock washer',
  category: 'FASTENERS & THREADS',
  subgroup: 'WASHERS',
  icon: 'bearing',
  complexity: 'Free / flattened',
  standard: 'DIN 127-B reference',
  description:
    'A split rectangular-section helical washer with offset ends and a flattened geometric state.',
  keywords: ['Grover', 'grower', 'spring washer', 'split', 'lock', 'DIN 127', 'helical'],
  defaults,
  parameters: [
    numberParameter('diameter', 'Nominal screw size', 'M', 'Identification', 1, 100, 0.5),
    numberParameter('innerDiameter', 'Inside diameter', 'd', 'Washer', 1, 150, 0.1),
    numberParameter('outerDiameter', 'Outside diameter', 'D', 'Washer', 2, 220, 0.1),
    numberParameter('thickness', 'Section thickness', 's', 'Washer', 0.1, 30, 0.05),
    numberParameter('freeHeight', 'Free overall height', 'h', 'Free state', 0.3, 70, 0.1),
    {
      ...numberParameter('gapAngle', 'Plan-view split angle', 'α', 'Free state', 2, 35, 1),
      unit: '°',
      description: 'Representative end gap; not provided in the reference dimensional table.',
    },
  ],
  presets: modulePresets,
  presetMatchKeys: ['diameter'],
  states: [
    {
      id: 'free',
      label: 'Free',
      description: 'Uncompressed helical washer with axially offset ends.',
    },
    {
      id: 'flattened',
      label: 'Flattened',
      description:
        'Both ends at the same height; this is a geometric state, not a force simulation.',
    },
  ],
  validate(p) {
    const errors: string[] = [];
    if (n(p, 'outerDiameter') <= n(p, 'innerDiameter') + 0.2)
      errors.push('The outside diameter must leave a positive radial section.');
    if (n(p, 'innerDiameter') <= n(p, 'diameter'))
      errors.push('The inside diameter must clear the nominal screw size.');
    if (n(p, 'freeHeight') < n(p, 'thickness'))
      errors.push('Free height cannot be smaller than section thickness.');
    if (n(p, 'freeHeight') > n(p, 'outerDiameter'))
      errors.push('Free height must stay below the outside diameter.');
    return errors;
  },
  buildGeometry(p, state) {
    const sections = lockWasherSections(p, state),
      mesh = new BoundaryMesh(),
      a = (n(p, 'gapAngle') * Math.PI) / 360;
    for (let i = 0; i < sections.length - 1; i++) mesh.bridge(sections[i], sections[i + 1]);
    mesh.face(sections[0], [], new Vector3(Math.sin(a), -Math.cos(a), 0));
    mesh.face(sections.at(-1)!, [], new Vector3(Math.sin(a), Math.cos(a), 0));
    const result = mesh.build();
    result.name = 'Split helical washer';
    return new Group().add(result);
  },
  dimensions: (p, state) => [
    (n(p, 'outerDiameter') / 2) * (1 + Math.cos((n(p, 'gapAngle') * Math.PI) / 360)),
    n(p, 'outerDiameter'),
    state === 'flattened' ? n(p, 'thickness') : n(p, 'freeHeight'),
  ],
  python(p, state) {
    const sections = lockWasherSections(p, state);
    return `# Reference helical strip; the supplier confirms only the nominal screw size.\nsections=[${sections.map((section) => `Part.makePolygon([${[...section, section[0]].map((v) => `App.Vector(${num(v.x)},${num(v.y)},${num(v.z)})`).join(',')}])`).join(',')} ]\nshape=Part.makeLoft(sections,True,True).removeSplitter()\nif len(shape.Solids)!=1: raise ValueError("The split washer must form one closed solid.")`;
  },
  notes:
    'Gvyntok presets verify the nominal screw size only; their pages do not identify DIN127 or a dimensional form. Profile dimensions use explicitly attributed Güde DIN127-B maximum reference envelopes. The split angle and sharp rectangular ends are representative. Flattening holds the radial envelope fixed and does not predict spring force, preload or resistance to loosening.',
  sources: [
    { label: 'Güde DIN127-B reference dimensional ranges', url: retentionWasherSources.split },
  ],
};
export default { ...part, presets: modulePresets };
