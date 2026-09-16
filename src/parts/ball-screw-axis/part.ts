import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group, Mesh } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import { material, n, num, numberParameter, ring } from '../../core/geometry';
import { booleans, primitives, solidUnionMesh, transforms } from '../../core/solid-union';
import { ballScrewReferences } from './lib/catalog/ball-screw-reference';
import ballScrew from './lib/parts/ball-screw';
import guide from './lib/parts/linear-guide';
import { ballScrewLayout } from './lib/parts/ball-screw-geometry';

type Point = [number, number, number];
type Hole = { axis: 'x' | 'z'; center: Point; diameter: number };
type Body = { label: string; size: Point; center: Point; holes: Hole[]; color: number };
const choices = ['SFK0802', 'SFU1204-4', 'SFU1605-4', 'SFU2005-4'];
const defaults: Parameters = {
  screwSize: 'SFU1605-4',
  length: 200,
  guideSize: 'mgn12h',
  guideSpacing: 100,
  position: 50,
  tableThickness: 8,
  baseThickness: 8,
  showSupports: true,
  detail: 'raceway',
};

export function ballScrewAxisLayout(p: Parameters) {
  const reference = ballScrewReferences.find((row) => row.designation === p.screwSize);
  if (!reference) throw new Error('Choose a supported screw size.');
  const d = Number(reference.parameters.shaftDiameter);
  const screw: Parameters = {
    ...ballScrew.defaults,
    ...reference.parameters,
    length: n(p, 'length'),
    detail: p.detail,
    endMachining: 'custom',
    fixedJournalDiameter: d * 0.75,
    fixedJournalLength: Math.max(10, d),
    driveJournalDiameter: d * 0.6,
    driveJournalLength: Math.max(10, d),
    supportJournalDiameter: d * 0.6,
    supportJournalLength: Math.max(8, d * 0.7),
    nutPosition: 50,
    rotation: 0,
  };
  const rail: Parameters = {
    ...guide.presets.find((preset) => preset.id === p.guideSize)!.parameters,
    length: n(p, 'length'),
  };
  const v = ballScrewLayout(screw),
    base = n(p, 'baseThickness'),
    spacing = n(p, 'guideSpacing');
  const tableLength = Math.max(n(rail, 'blockLength') + 12, n(screw, 'nutLength') + 12);
  const width = spacing + n(rail, 'blockWidth') + 16;
  const screwZ = base + n(screw, 'flangeDiameter') / 2 + 4;
  const tableBottom = screwZ + n(screw, 'flangeDiameter') / 2 + 3;
  const left = Math.max(v.start + v.nl / 2 + v.lead, v.start + tableLength / 2 + 4);
  const right = Math.min(v.end - v.nl / 2 - v.lead, v.end - tableLength / 2 - 4);
  const center = left + ((right - left) * n(p, 'position')) / 100;
  const freeTravel = v.end - v.start - v.nl - 2 * v.lead;
  screw.nutPosition = 50 + ((center - (v.start + v.end) / 2) / freeTravel) * 100;
  rail.position = 50 + (center / (n(p, 'length') - n(rail, 'blockLength'))) * 100;
  return {
    screw,
    rail,
    v: ballScrewLayout(screw),
    base,
    spacing,
    width,
    tableLength,
    screwZ,
    tableBottom,
    center,
    travel: right - left,
  };
}
function bodies(p: Parameters): Body[] {
  const v = ballScrewAxisLayout(p),
    length = n(p, 'length'),
    tableT = n(p, 'tableThickness');
  const result: Body[] = [
    {
      label: 'Axis base plate',
      size: [length + 16, v.width, v.base],
      center: [0, 0, v.base / 2],
      holes: [],
      color: 0x414b59,
    },
  ];
  for (const x of [-length / 2 + 5, length / 2 - 5])
    for (const y of [-v.width / 2 + 6, v.width / 2 - 6])
      result[0].holes.push({ axis: 'z', center: [x, y, 0], diameter: 4.5 });
  const table: Body = {
    label: 'Moving mounting table',
    size: [v.tableLength, v.width, tableT],
    center: [v.center, 0, v.tableBottom + tableT / 2],
    holes: [],
    color: 0x9ba7b5,
  };
  const top = v.base + n(v.rail, 'totalHeight'),
    rise = v.tableBottom - top;
  for (const side of [-1, 1]) {
    const riser: Body = {
      label: `${side < 0 ? 'Left' : 'Right'} carriage riser`,
      size: [n(v.rail, 'blockLength'), n(v.rail, 'blockWidth'), rise],
      center: [v.center, (side * v.spacing) / 2, top + rise / 2],
      holes: [],
      color: 0x687889,
    };
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const hole: Hole = {
          axis: 'z',
          center: [
            v.center + (sx * n(v.rail, 'blockPitchX')) / 2,
            (side * v.spacing) / 2 + (sy * n(v.rail, 'blockPitchY')) / 2,
            0,
          ],
          diameter: n(v.rail, 'blockHole') + 0.3,
        };
        riser.holes.push(hole);
        table.holes.push(hole);
      }
    result.push(riser);
  }
  for (const x of [-v.tableLength / 4, v.tableLength / 4])
    for (const y of [-v.spacing / 4, v.spacing / 4])
      table.holes.push({ axis: 'z', center: [v.center + x, y, 0], diameter: 5 });
  const nutR = n(v.screw, 'nutDiameter') / 2,
    mountBottom = v.screwZ - nutR - 6;
  const mountLength = n(v.screw, 'nutLength') - n(v.screw, 'flangeThickness') - 1;
  const mount: Body = {
    label: 'Ball-nut mounting saddle',
    size: [mountLength, n(v.screw, 'flangeDiameter') + 6, v.tableBottom - mountBottom],
    center: [
      v.center + (n(v.screw, 'flangeThickness') + 1) / 2,
      0,
      (v.tableBottom + mountBottom) / 2,
    ],
    holes: [
      {
        axis: 'x',
        center: [0, 0, v.screwZ],
        diameter: n(v.screw, 'nutDiameter') + n(v.screw, 'ballDiameter') + 0.5,
      },
    ],
    color: 0x72869b,
  };
  for (const angle of Number(v.screw.mountHoleCount) === 4
    ? [60, 120, 240, 300]
    : [45, 90, 135, 225, 270, 315]) {
    const radians = (angle * Math.PI) / 180;
    mount.holes.push({
      axis: 'x',
      center: [
        0,
        (Math.sin(radians) * n(v.screw, 'mountCircle')) / 2,
        v.screwZ - (Math.cos(radians) * n(v.screw, 'mountCircle')) / 2,
      ],
      diameter: n(v.screw, 'mountHoleDiameter'),
    });
  }
  for (const side of [-1, 1]) {
    const hole: Hole = {
      axis: 'z',
      center: [mount.center[0], side * (mount.size[1] / 2 - 5), 0],
      diameter: 3.4,
    };
    mount.holes.push(hole);
    table.holes.push(hole);
  }
  result.push(mount, table);
  if (p.showSupports)
    for (const fixed of [true, false]) {
      const journal = n(v.screw, fixed ? 'fixedJournalDiameter' : 'supportJournalDiameter');
      const thickness = n(v.screw, fixed ? 'fixedJournalLength' : 'supportJournalLength') - 0.4;
      const x = fixed
        ? v.v.start - n(v.screw, 'fixedJournalLength') / 2
        : v.v.end + n(v.screw, 'supportJournalLength') / 2;
      const h = v.screwZ - v.base + journal / 2 + 8;
      const support: Body = {
        label: fixed ? 'Fixed end support' : 'Floating end support',
        size: [thickness, journal + 24, h],
        center: [x, 0, v.base + h / 2],
        holes: [{ axis: 'x', center: [0, 0, v.screwZ], diameter: journal + 8 }],
        color: 0x303a48,
      };
      for (const side of [-1, 1])
        support.holes.push({ axis: 'z', center: [x, side * (journal / 2 + 8), 0], diameter: 3.5 });
      result.push(support);
    }
  return result;
}
function bodyMesh(body: Body) {
  let solid = primitives.cuboid({ size: body.size });
  for (const hole of body.holes) {
    let tool = primitives.cylinder({
      height: Math.max(...body.size) + 2,
      radius: hole.diameter / 2,
      segments: 48,
    });
    if (hole.axis === 'x') tool = transforms.rotateY(Math.PI / 2, tool);
    const offset: Point = hole.center.map((value, i) =>
      (hole.axis === 'x' && i === 0) || (hole.axis === 'z' && i === 2) ? 0 : value - body.center[i],
    ) as Point;
    solid = booleans.subtract(solid, transforms.translate(offset, tool));
  }
  const group = solidUnionMesh(solid);
  group.position.set(...body.center);
  group.name = body.label;
  group.traverse((object) => {
    if (object instanceof Mesh) object.material = material(body.color);
  });
  return group;
}
function bodyPython(body: Body) {
  const corner = body.center.map((value, i) => value - body.size[i] / 2);
  const lines = [
    `item = Part.makeBox(${body.size.map(num).join(',')},App.Vector(${corner.map(num).join(',')}))`,
  ];
  for (const hole of body.holes) {
    const axis = hole.axis === 'x' ? 0 : 2,
      origin = [...hole.center];
    origin[axis] = corner[axis] - 1;
    lines.push(
      `item = item.cut(Part.makeCylinder(${num(hole.diameter / 2)},${num(body.size[axis] + 2)},App.Vector(${origin.map(num).join(',')}),App.Vector(${hole.axis === 'x' ? '1,0,0' : '0,0,1'})))`,
    );
  }
  lines.push(
    'axis_components.append(item.removeSplitter())',
    `axis_labels.append(${JSON.stringify(body.label)})`,
    `axis_colors.append(${JSON.stringify([((body.color >> 16) & 255) / 255, ((body.color >> 8) & 255) / 255, (body.color & 255) / 255])})`,
  );
  return lines.join('\n');
}
function bearings(p: Parameters) {
  const v = ballScrewAxisLayout(p);
  return [true, false].map((fixed) => ({
    label: fixed ? 'Fixed support bearing' : 'Floating support bearing',
    bore: n(v.screw, fixed ? 'fixedJournalDiameter' : 'supportJournalDiameter'),
    length: n(v.screw, fixed ? 'fixedJournalLength' : 'supportJournalLength') - 0.6,
    center: [
      fixed
        ? v.v.start - n(v.screw, 'fixedJournalLength') / 2
        : v.v.end + n(v.screw, 'supportJournalLength') / 2,
      0,
      v.screwZ,
    ] as Point,
  }));
}
type Fastener = { label: string; diameter: number; length: number; center: Point; axis: 'x' | 'z' };
function fasteners(p: Parameters): Fastener[] {
  const v = ballScrewAxisLayout(p),
    top = v.tableBottom + n(p, 'tableThickness');
  const result: Fastener[] = [];
  const d = n(v.rail, 'blockHole') - 0.2;
  const length = top - v.base - n(v.rail, 'totalHeight') + 1.5;
  for (const side of [-1, 1])
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        result.push({
          label: `${side < 0 ? 'Left' : 'Right'} carriage bolt ${sx}.${sy}`,
          diameter: d,
          length,
          center: [
            v.center + (sx * n(v.rail, 'blockPitchX')) / 2,
            (side * v.spacing) / 2 + (sy * n(v.rail, 'blockPitchY')) / 2,
            top - length / 2 + d / 2,
          ],
          axis: 'z',
        });
  const mount = bodies(p).find((body) => body.label === 'Ball-nut mounting saddle')!;
  for (const side of [-1, 1])
    result.push({
      label: `Saddle mounting bolt ${side}`,
      diameter: 3,
      length: n(p, 'tableThickness') + 5,
      center: [
        mount.center[0],
        side * (mount.size[1] / 2 - 5),
        top - (n(p, 'tableThickness') + 5) / 2 + 1.5,
      ],
      axis: 'z',
    });
  const boltD = n(v.screw, 'mountHoleDiameter') - 0.5,
    boltL = n(v.screw, 'flangeThickness') + 6;
  for (const [i, angle] of (Number(v.screw.mountHoleCount) === 4
    ? [60, 120, 240, 300]
    : [45, 90, 135, 225, 270, 315]
  ).entries()) {
    const a = (angle * Math.PI) / 180;
    result.push({
      label: `Nut flange bolt ${i + 1}`,
      diameter: boltD,
      length: boltL,
      axis: 'x',
      center: [
        v.center - n(v.screw, 'nutLength') / 2 + (boltL - boltD) / 2,
        (Math.sin(a) * n(v.screw, 'mountCircle')) / 2,
        v.screwZ - (Math.cos(a) * n(v.screw, 'mountCircle')) / 2,
      ],
    });
  }
  return result;
}
function fastenerMesh(b: Fastener) {
  const total = b.length + b.diameter;
  const shaft = primitives.cylinder({
    radius: b.diameter / 2,
    height: b.length,
    center: [0, 0, -b.diameter / 2],
    segments: 32,
  });
  const head = primitives.cylinder({
    radius: b.diameter * 0.85,
    height: b.diameter,
    center: [0, 0, b.length / 2],
    segments: 32,
  });
  const drive = primitives.cylinder({
    radius: b.diameter * 0.42,
    height: b.diameter,
    center: [0, 0, total / 2],
    segments: 6,
  });
  const group = solidUnionMesh(booleans.subtract(booleans.union(shaft, head), drive));
  group.name = b.label;
  group.position.set(...b.center);
  if (b.axis === 'x') group.rotation.y = -Math.PI / 2;
  group.traverse((object) => {
    if (object instanceof Mesh) object.material = material(0x252d38);
  });
  return group;
}
function fastenerPython(b: Fastener) {
  const total = b.length + b.diameter;
  return `item = Part.makeCylinder(${num(b.diameter / 2)},${num(b.length)},App.Vector(0,0,${num(-total / 2)})).fuse(Part.makeCylinder(${num(b.diameter * 0.85)},${num(b.diameter)},App.Vector(0,0,${num(total / 2 - b.diameter)})))
points = [App.Vector(${num(b.diameter * 0.42)}*math.cos(i*math.pi/3),${num(b.diameter * 0.42)}*math.sin(i*math.pi/3),${num(total / 2 - b.diameter / 2)}) for i in range(6)]
item = item.cut(Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,${num(b.diameter)}))).removeSplitter()
${b.axis === 'x' ? 'item.rotate(App.Vector(),App.Vector(0,1,0),-90)' : ''}
item.translate(App.Vector(${b.center.map(num).join(',')}))
axis_components.append(item)
axis_labels.append(${JSON.stringify(b.label)})
axis_colors.append((0.15,0.18,0.22))`;
}
function build(p: Parameters, state: string) {
  const v = ballScrewAxisLayout(p),
    group = new Group();
  const screw = ballScrew.buildGeometry(v.screw, state === 'cutaway' ? 'cutaway' : 'assembled');
  screw.rotation.y = Math.PI / 2;
  screw.position.z = v.screwZ;
  group.add(screw);
  for (const side of [-1, 1]) {
    const rail = guide.buildGeometry(v.rail, state === 'cutaway' ? 'cutaway' : 'assembled');
    rail.position.set(0, (side * v.spacing) / 2, v.base);
    group.add(rail);
  }
  for (const body of bodies(p)) group.add(bodyMesh(body));
  if (p.showSupports)
    for (const bearing of bearings(p)) {
      const mesh = ring(bearing.bore / 2 + 3.95, bearing.bore / 2 + 0.1, bearing.length, 0x8294a7);
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(...bearing.center);
      mesh.name = bearing.label;
      group.add(mesh);
    }
  for (const bolt of fasteners(p)) group.add(fastenerMesh(bolt));
  return group;
}
const part: PartDefinition = {
  id: 'ball-screw-axis',
  name: 'Ball screw linear actuator',
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'Guided linear assembly',
  description:
    'A ball screw drives a mounting table on two profile guide rails with fixed and floating screw supports.',
  keywords: [
    'ballscrew',
    'ball screw guide',
    'ballscrew guides',
    'ball screw guides',
    'linear axis',
    'linear actuator',
    'table',
    'stage',
    'SFK',
    'SFU',
    'MGN',
    'CNC',
  ],
  defaults,
  parameters: [
    {
      key: 'screwSize',
      label: 'Ball screw size',
      type: 'select',
      group: 'Axis selection',
      options: choices.map((value) => {
        const dimensions = ballScrewReferences.find((row) => row.designation === value)!.parameters;
        return {
          value,
          label: `${value} · Ø${dimensions.shaftDiameter} · lead ${dimensions.lead} mm`,
        };
      }),
    },
    {
      key: 'guideSize',
      label: 'Guide size',
      type: 'select',
      group: 'Axis selection',
      options: ['mgn12h', 'mgn15h'].map((value) => ({ value, label: value.toUpperCase() })),
    },
    numberParameter('length', 'Axis length', 'L', 'Axis selection', 200, 800, 50),
    numberParameter('guideSpacing', 'Guide center spacing', 'S', 'Axis selection', 70, 240, 5),
    { ...numberParameter('position', 'Table position', 'x', 'Motion', 0, 100, 1), unit: '%' },
    {
      key: 'detail',
      label: 'Screw detail',
      type: 'select',
      group: 'Display',
      options: [
        { value: 'envelope', label: 'Fast envelope' },
        { value: 'raceway', label: 'Helical raceways and balls' },
      ],
    },
    {
      key: 'showSupports',
      label: 'Screw end supports',
      type: 'boolean',
      group: 'Assembly structure',
    },
    numberParameter('tableThickness', 'Table thickness', 'T', 'Assembly structure', 5, 20, 1),
    numberParameter('baseThickness', 'Base plate thickness', 'B', 'Assembly structure', 5, 20, 1),
  ],
  presets: modulePresets,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Table, nut and carriages share the configured travel position.',
    },
    {
      id: 'cutaway',
      label: 'Inspect ball circuits',
      description:
        'Open nut and carriage housings; choose helical detail to inspect screw raceway balls.',
    },
  ],
  presetMatchKeys: ['screwSize', 'length', 'guideSize', 'guideSpacing'],
  validate(p) {
    const v = ballScrewAxisLayout(p),
      errors = [
        ...ballScrew.validate(v.screw, 'assembled'),
        ...guide.validate(v.rail, 'assembled'),
      ];
    if (v.spacing < n(v.screw, 'flangeDiameter') + n(v.rail, 'blockWidth') + 12)
      errors.push('Increase guide spacing to clear the nut saddle and carriage risers.');
    if (v.travel < 10) errors.push('The axis needs at least 10 mm of usable table travel.');
    return errors;
  },
  buildGeometry: build,
  dimensions(p) {
    const v = ballScrewAxisLayout(p);
    return [
      n(p, 'length') + 16,
      v.width,
      v.tableBottom + n(p, 'tableThickness') + Math.max(3, n(v.rail, 'blockHole') - 0.2),
    ];
  },
  python(p, state) {
    const v = ballScrewAxisLayout(p),
      chunks = ['axis_components = []', 'axis_labels = []', 'axis_colors = []'];
    const add = (name: string, source: string, transform: string, prefix: string) => {
      chunks.push(
        `def ${name}():\n    component_labels = None\n    component_colors = None\n${source
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}\n    return shape, component_labels, component_colors`,
        `child_shape, child_labels, child_colors = ${name}()`,
        transform,
        'child_components = child_shape.childShapes() if child_shape.ShapeType == "Compound" else [child_shape]',
        'axis_components.extend(child_components)',
        `axis_labels.extend([${JSON.stringify(prefix)} + label for label in child_labels] if child_labels is not None else [${JSON.stringify(prefix + 'Component ')} + str(i+1) for i in range(len(child_components))])`,
        'axis_colors.extend(child_colors if child_colors is not None else [(0.62,0.70,0.78)] * len(child_components))',
      );
    };
    add(
      'axis_screw',
      ballScrew.python(v.screw, state === 'cutaway' ? 'cutaway' : 'assembled'),
      `child_shape.rotate(App.Vector(),App.Vector(0,1,0),90)\nchild_shape.translate(App.Vector(0,0,${num(v.screwZ)}))`,
      'Drive · ',
    );
    for (const side of [-1, 1])
      add(
        `axis_guide_${side < 0 ? 'left' : 'right'}`,
        guide.python(v.rail, state === 'cutaway' ? 'cutaway' : 'assembled'),
        `child_shape.translate(App.Vector(0,${num((side * v.spacing) / 2)},${num(v.base)}))`,
        `${side < 0 ? 'Left' : 'Right'} guide · `,
      );
    for (const body of bodies(p)) chunks.push(bodyPython(body));
    if (p.showSupports)
      for (const b of bearings(p))
        chunks.push(
          `item = Part.makeCylinder(${num(b.bore / 2 + 3.95)},${num(b.length)},App.Vector(${num(b.center[0] - b.length / 2)},0,${num(b.center[2])}),App.Vector(1,0,0))\nitem = item.cut(Part.makeCylinder(${num(b.bore / 2 + 0.1)},${num(b.length + 2)},App.Vector(${num(b.center[0] - b.length / 2 - 1)},0,${num(b.center[2])}),App.Vector(1,0,0)))\naxis_components.append(item)\naxis_labels.append(${JSON.stringify(b.label)})\naxis_colors.append((0.51,0.58,0.65))`,
        );
    for (const bolt of fasteners(p)) chunks.push(fastenerPython(bolt));
    chunks.push(
      'shape = Part.makeCompound(axis_components)',
      'component_labels = axis_labels',
      'component_colors = axis_colors',
    );
    return chunks.join('\n');
  },
  sources: [
    { label: 'Supplied SFU dimensions', url: '' },
    ...(guide.sources ?? []),
  ],
  notes:
    'Prototype axis assembly. Screw/nut and MGN rail envelopes use the selected catalog rows; base, saddle, risers, support bearings and machined journals are custom layout geometry. End bearing rings represent clearances, not a bearing selection or load rating. Table travel is limited to clear both screw supports. The fast envelope omits screw raceway balls; choose helical detail to inspect them.',
};
export default { ...part, presets: modulePresets };
