import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Path, Shape, Vector2 } from 'three';
import type { PartDefinition, Parameters } from '../../core/types';
import { annulusPython, ACCENT, extrude, n, num, numberParameter, ring } from '../../core/geometry';
import { pythonWire } from '../../core/mechanical';
import * as kp from './lib/kp';

function slotPoints(center: number, diameter: number, length: number): Vector2[] {
  const r = diameter / 2,
    offset = (length - diameter) / 2;
  return [
    ...Array.from({ length: 37 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.PI * i) / 36;
      return new Vector2(center + offset + r * Math.cos(a), r * Math.sin(a));
    }),
    ...Array.from({ length: 37 }, (_, i) => {
      const a = Math.PI / 2 + (Math.PI * i) / 36;
      return new Vector2(center - offset + r * Math.cos(a), r * Math.sin(a));
    }),
  ]
    .filter((point, index, points) => index === 0 || point.distanceTo(points[index - 1]) > 1e-8)
    .filter(
      (point, index) => index === 0 || point.distanceTo(new Vector2(center + offset, -r)) > 1e-8,
    );
}
function crownPoints(p: Parameters): Vector2[] {
  const R = n(p, 'outer') / 2,
    H = n(p, 'centerHeight'),
    T = n(p, 'totalHeight') - H;
  return [
    new Vector2(-R, -H + n(p, 'baseThickness')),
    new Vector2(R, -H + n(p, 'baseThickness')),
    ...Array.from(
      { length: 65 },
      (_, i) => new Vector2(R * Math.cos((Math.PI * i) / 64), T * Math.sin((Math.PI * i) / 64)),
    ),
  ];
}
const defaults = { ...modulePresets.find((preset) => preset.id === 'kp001-mini-tech')!.parameters };
const part: PartDefinition = {
  id: 'pillow-block-bearing',
  name: 'Pillow block bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'MOUNTED BEARINGS',
  description:
    'Cast KP08/KP001 supports and UCP bearing housings, with sourced shaft heights, mounting patterns and separate bearing components.',
  keywords: [
    'pillow',
    'plummer',
    'mounted',
    'housing',
    'shaft',
    'support',
    'UCP204',
    'UCP205',
    'KP08',
    'KP001',
    'Mini-Tech',
  ],
  icon: 'bearing',
  complexity: 'Assembly',
  parameters: [
    {
      key: 'housingStyle',
      label: 'Housing style',
      type: 'select',
      group: 'Bearing',
      options: [
        { value: 'kp', label: 'KP cast compact housing' },
        { value: 'ucp', label: 'UCP housing envelope' },
      ],
    },
    numberParameter('bore', 'Shaft diameter', 'd', 'Bearing', 3, 100),
    numberParameter('outer', 'Housing crown width', 'D', 'Bearing', 15, 400),
    numberParameter('width', 'Housing depth', 'B', 'Bearing', 6, 100),
    numberParameter('insertWidth', 'Insert axial width', 'Bi', 'Bearing', 6, 150),
    {
      ...numberParameter('insertOffset', 'Insert axial offset', 'Y', 'Bearing', -50, 50),
      visibleWhen: (p) => p.housingStyle === 'kp',
      description: 'Offset of the insert midpoint along the shaft axis. KP001: S − B/2 = −3.25 mm.',
    },
    numberParameter('totalHeight', 'Overall height', 'Ht', 'Mount', 20, 350),
    numberParameter('centerHeight', 'Shaft center height', 'H', 'Mount', 10, 200),
    numberParameter('baseWidth', 'Base width', 'L', 'Mount', 30, 600),
    numberParameter('baseDepth', 'Base depth', 'A', 'Mount', 6, 200),
    numberParameter('baseThickness', 'Base thickness', 't', 'Mount', 2, 100),
    numberParameter('hole', 'Mount slot diameter', 'N', 'Mount', 2, 30),
    numberParameter('slotLength', 'Mount slot length', 'N1', 'Mount', 2, 60),
    numberParameter('mountPitch', 'Mount centers', 'J', 'Mount', 10, 580),
  ],
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['housingStyle', 'bore', 'totalHeight', 'baseWidth', 'baseDepth', 'mountPitch'],
  sources: [
    ...new Map(
      modulePresets
        .filter((p) => p.catalog)
        .flatMap((p) => [
          {
            label: `${p.catalog!.sourceName} · ${p.catalog!.designation}`,
            url: p.catalog!.sourceUrl,
          },
          ...(p.catalog!.alternateSourceUrls ?? []).map((url) => ({
            label: 'KP dimension drawing',
            url,
          })),
        ])
        .map((source) => [source.url, source]),
    ).values(),
  ],
  validate(p) {
    const errors: string[] = [],
      R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      bearingR = p.housingStyle === 'kp' ? kp.layout(p).seat : r + (R - r) * 0.6;
    if (R <= r + 4) errors.push('Housing crown width must exceed the bore by more than 8 mm.');
    if (
      n(p, 'centerHeight') <=
      (p.housingStyle === 'kp' ? 0 : n(p, 'baseThickness')) + bearingR + 1
    )
      errors.push('Raise the shaft center to clear the mounting base.');
    if (n(p, 'totalHeight') - n(p, 'centerHeight') <= bearingR + 1)
      errors.push('Increase the overall height so the crown surrounds the insert.');
    if (n(p, 'slotLength') < n(p, 'hole'))
      errors.push('Slot length must be at least its diameter.');
    if (n(p, 'mountPitch') + n(p, 'slotLength') >= n(p, 'baseWidth') - 2)
      errors.push('Mounting slots need at least 1 mm of material at both base ends.');
    if ((n(p, 'mountPitch') - n(p, 'slotLength')) / 2 <= R + 1)
      errors.push('Move the mounting slots outward to clear the housing.');
    if (n(p, 'baseDepth') < Math.max(n(p, 'width'), n(p, 'hole') + 2))
      errors.push('Base depth must contain the housing and mounting slots.');
    if (p.housingStyle === 'kp') {
      const a = kp.layout(p);
      if (a.seat <= r + 2) errors.push('Increase the KP crown width to contain the bearing rings.');
      if (a.raceWidth < 2)
        errors.push('Keep at least 2 mm of insert width across the housing centre plane.');
      if (n(p, 'baseThickness') >= n(p, 'centerHeight'))
        errors.push('The KP base must stay below the shaft centre.');
    }
    return errors;
  },
  buildGeometry(p) {
    if (p.housingStyle === 'kp') return kp.geometry(p);
    const group = new Group(),
      R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2;
    const bearingR = r + (R - r) * 0.6,
      w = n(p, 'width'),
      H = n(p, 'centerHeight'),
      t = n(p, 'baseThickness');
    const baseW = n(p, 'baseWidth'),
      baseD = n(p, 'baseDepth');
    const profile = new Shape(crownPoints(p));
    const bore = new Path();
    bore.absarc(0, 0, bearingR, 0, Math.PI * 2, true);
    profile.holes.push(bore);
    const housing = extrude(profile, w, ACCENT);
    housing.rotation.x = Math.PI / 2;
    group.add(housing);
    const base = new Shape([
      new Vector2(-baseW / 2, -baseD / 2),
      new Vector2(baseW / 2, -baseD / 2),
      new Vector2(baseW / 2, baseD / 2),
      new Vector2(-baseW / 2, baseD / 2),
    ]);
    for (const side of [-1, 1])
      base.holes.push(
        new Path(slotPoints((side * n(p, 'mountPitch')) / 2, n(p, 'hole'), n(p, 'slotLength'))),
      );
    const foot = extrude(base, t, ACCENT);
    foot.position.z = -H + t / 2;
    group.add(foot);
    const insert = ring(bearingR, r, n(p, 'insertWidth'));
    insert.rotation.x = Math.PI / 2;
    group.add(insert);
    return group;
  },
  python(p) {
    if (p.housingStyle === 'kp') return kp.python(p);
    const R = n(p, 'outer') / 2,
      r = n(p, 'bore') / 2,
      bearingR = r + (R - r) * 0.6;
    const w = n(p, 'width'),
      H = n(p, 'centerHeight'),
      t = n(p, 'baseThickness'),
      baseW = n(p, 'baseWidth'),
      baseD = n(p, 'baseDepth');
    const points = crownPoints(p),
      outline = [...points, points[0]]
        .map((point) => `App.Vector(${num(point.x)}, ${num(-w / 2)}, ${num(point.y)})`)
        .join(', ');
    const cuts = [-1, 1]
      .map(
        (side) =>
          `base = base.cut(Part.Face(${pythonWire(slotPoints((side * n(p, 'mountPitch')) / 2, n(p, 'hole'), n(p, 'slotLength')), -H - 1)}).extrude(App.Vector(0, 0, ${num(t + 2)})))`,
      )
      .join('\n');
    return `housing = Part.Face(Part.makePolygon([${outline}])).extrude(App.Vector(0, ${num(w)}, 0))
housing = housing.cut(Part.makeCylinder(${num(bearingR)}, ${num(w + 2)}, App.Vector(0, ${num(-w / 2 - 1)}, 0), App.Vector(0, 1, 0)))
base = Part.makeBox(${num(baseW)}, ${num(baseD)}, ${num(t)}, App.Vector(${num(-baseW / 2)}, ${num(-baseD / 2)}, ${num(-H)}))
${cuts}
housing = housing.fuse(base).removeSplitter()
insert = ${annulusPython(bearingR, r, n(p, 'insertWidth'))}
insert.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 90)
shape = Part.makeCompound([housing, insert])`;
  },
  dimensions: (p) => [
    n(p, 'baseWidth'),
    p.housingStyle === 'kp'
      ? Math.max(n(p, 'baseDepth') / 2, n(p, 'insertOffset') + n(p, 'insertWidth') / 2) -
        Math.min(-n(p, 'baseDepth') / 2, n(p, 'insertOffset') - n(p, 'insertWidth') / 2)
      : Math.max(n(p, 'baseDepth'), n(p, 'width'), n(p, 'insertWidth')),
    n(p, 'totalHeight'),
  ],
  notes:
    'The origin is at the shaft centre, with the shaft along Y and the foot at Z = −H. KP08/KP001 use supplied drawing dimensions; the cast contours, bearing internals and unthreaded socket set screws are illustrative. KP001 B = 14.5 and S = 4 place the insert asymmetrically, so the complete depth is 18.5 mm although the housing base is A = 16 mm. KP08 insert width/offset are not published. Mount holes follow drawing N, which conflicts with the supplier bolt labels. UCP crown, base thickness, insert section and unspecified slot dimensions remain representative. No rolling elements or self-alignment simulation.',
};
export default { ...part, presets: modulePresets };
