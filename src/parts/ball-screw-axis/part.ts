import { detailComponent } from '../../core/component-recipes';
import { nutCoarsePitch } from '../../core/hardware/internal-thread';
import {
  box,
  cylinder,
  subtract,
  union,
  prism,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import type { AssemblyDefinition, AssemblyComponent } from '../../core/product-types';
import productData from './product.json';
import type { ProductProfile } from '../../core/product-types';
import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Group } from 'three';
import detail from '../manufactured-detail/part';
import {
  componentGeometry,
  componentPython,
  componentMetadataPlacementPython,
  type ConfiguredPiece,
} from '../../core/assembly/detail-instances';
import type { Parameters, PartDefinition } from '../../core/types';
import { n, num, numberParameter } from '../../core/geometry';
import { ballScrewReferences } from './lib/catalog/ball-screw-reference';
import ballScrew from '../ball-screw/part';
import guide from '../linear-guide/part';
import { ballScrewLayout } from '../ball-screw/lib/parts/ball-screw-geometry';

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
function customInstances(p: Parameters): ConfiguredPiece[] {
  const result: ConfiguredPiece[] = [];
  for (const [index, body] of bodies(p).entries()) {
    const start = body.center.map((value, i) => value - body.size[i] / 2) as Point;
    const tools = body.holes.map((hole) => {
      const axis = hole.axis === 'x' ? 0 : 2,
        origin = [...hole.center] as Point;
      origin[axis] = start[axis] - 1;
      return cylinder(hole.diameter / 2, body.size[axis] + 2, origin, hole.axis);
    });
    result.push({
      label: body.label,
      color: body.color,
      component: detailComponent(
        'body-' + index,
        body.label,
        tools.length ? subtract(box(body.size, start), ...tools) : box(body.size, start),
        { edgeTolerance: 1e-6 },
      ),
    });
  }
  if (p.showSupports)
    for (const [index, b] of bearings(p).entries()) {
      const origin: Point = [b.center[0] - b.length / 2, 0, b.center[2]];
      result.push({
        label: b.label,
        color: 0x8294a7,
        component: detailComponent(
          'support-ring-' + index,
          b.label,
          subtract(
            { ...cylinder(b.bore / 2 + 3.95, b.length, origin, 'x'), segments: 128 } as Shape,
            {
              ...cylinder(b.bore / 2 + 0.1, b.length + 2, [origin[0] - 1, 0, origin[2]], 'x'),
              segments: 128,
            } as Shape,
          ),
          { edgeTolerance: 1e-6 },
        ),
      });
    }
  for (const [index, b] of fasteners(p).entries()) {
    const total = b.length + b.diameter;
    const drive: [number, number][] = Array.from({ length: 6 }, (_, i) => [
      b.diameter * 0.42 * Math.cos((i * Math.PI) / 3),
      b.diameter * 0.42 * Math.sin((i * Math.PI) / 3),
    ]);
    const shape: Shape = {
      kind: 'transform',
      child: subtract(
        union(
          {
            ...cylinder(b.diameter / 2, b.length, [0, 0, -total / 2]),
            segments: 32,
            thread: { pitch: nutCoarsePitch(b.diameter) },
          } as Shape,
          {
            ...cylinder(b.diameter * 0.85, b.diameter, [0, 0, total / 2 - b.diameter]),
            segments: 32,
          } as Shape,
        ),
        prism(drive, b.diameter, total / 2 - b.diameter / 2),
      ),
      translation: b.center,
      rotation: [0, b.axis === 'x' ? -90 : 0, 0],
    };
    result.push({
      label: b.label,
      color: 0x252d38,
      component: detailComponent('custom-fastener-' + index, b.label, shape, {
        edgeTolerance: 1e-6,
      }),
    });
  }
  return result;
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
  const customs = componentGeometry([detail], customInstances(p));
  group.add(...customs.children);
  return group;
}

/** Full physical composition; table pose and detail toggles do not alter the definition. */
function composition(parameters: Parameters): AssemblyDefinition {
  const p: Parameters = { ...parameters, position: 50, detail: 'raceway' },
    v = ballScrewAxisLayout(p);
  const components: AssemblyComponent[] = [
    {
      id: 'drive',
      libraryId: 'ball-screw',
      parameters: v.screw,
      state: 'assembled',
      name: 'Configured ball screw and nut',
      supply: 'purchased',
      quantity: 1,
      placement: { translation: [0, 0, v.screwZ], rotation: [0, 90, 0] },
    },
    ...[-1, 1].map((side) => ({
      id: side < 0 ? 'left-guide' : 'right-guide',
      libraryId: 'linear-guide',
      parameters: v.rail,
      state: 'assembled',
      name: side < 0 ? 'Left profile guide' : 'Right profile guide',
      supply: 'purchased' as const,
      quantity: 1,
      placement: {
        translation: [0, (side * v.spacing) / 2, v.base] as Point,
        rotation: [0, 0, 0] as Point,
      },
    })),
  ];
  components.push(...customInstances(p).map((piece) => piece.component));
  return {
    components,
    issues: [
      'Select actual end support bearings and stock fastener designations. Current rings and fasteners retain prototype fit geometry, not a qualified purchase selection. Specify stock, material, operations, fits and drawings for the custom supports and mounting bodies. Confirm screw-end machining with the supplier.',
    ],
  };
}
const part: PartDefinition = {
  id: 'ball-screw-axis',
  composition,
  product: productData as ProductProfile,
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
      visibleWhen: () => false,
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
        'Open nut and carriage housings; global Full mode also reveals the screw raceways.',
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
      chunks = [
        'import json',
        componentMetadataPlacementPython(),
        'axis_components = []',
        'axis_labels = []',
        'axis_colors = []',
        'axis_metadata = []',
      ];
    const add = (
      name: string,
      source: string,
      transform: string,
      prefix: string,
      library: PartDefinition,
      parameters: Parameters,
      rotation: Point,
      translation: Point,
    ) => {
      const provenance = {
        LibraryId: library.id,
        ConfigurationJSON: JSON.stringify(parameters),
        Supply: 'purchased',
      };
      chunks.push(
        `def ${name}():\n    component_labels = None\n    component_colors = None\n    component_metadata = None\n${source
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}\n    return shape, component_labels, component_colors, component_metadata`,
        `child_shape, child_labels, child_colors, child_metadata = ${name}()`,
        transform,
        'child_components = child_shape.childShapes() if child_shape.ShapeType == "Compound" else [child_shape]',
        'axis_components.extend(child_components)',
        `axis_labels.extend([${JSON.stringify(prefix)} + label for label in child_labels] if child_labels is not None else [${JSON.stringify(prefix + 'Component ')} + str(i+1) for i in range(len(child_components))])`,
        'axis_colors.extend(child_colors if child_colors is not None else [(0.62,0.70,0.78)] * len(child_components))',
        'if child_metadata is not None and len(child_metadata) != len(child_components):',
        `    raise ValueError(${JSON.stringify('Library component metadata does not match ' + library.id)})`,
        `axis_metadata.extend(dict(_pl_placed_metadata(metadata, ${JSON.stringify(rotation)}, ${JSON.stringify(translation)}, 0, [0,0,0]), **${JSON.stringify(provenance)}) for metadata in (child_metadata if child_metadata is not None else [{} for _ in child_components]))`,
      );
    };
    add(
      'axis_screw',
      ballScrew.python(v.screw, state === 'cutaway' ? 'cutaway' : 'assembled'),
      `child_shape.rotate(App.Vector(),App.Vector(0,1,0),90)\nchild_shape.translate(App.Vector(0,0,${num(v.screwZ)}))`,
      'Drive · ',
      ballScrew,
      v.screw,
      [0, 90, 0],
      [0, 0, v.screwZ],
    );
    for (const side of [-1, 1])
      add(
        `axis_guide_${side < 0 ? 'left' : 'right'}`,
        guide.python(v.rail, state === 'cutaway' ? 'cutaway' : 'assembled'),
        `child_shape.translate(App.Vector(0,${num((side * v.spacing) / 2)},${num(v.base)}))`,
        `${side < 0 ? 'Left' : 'Right'} guide · `,
        guide,
        v.rail,
        [0, 0, 0],
        [0, (side * v.spacing) / 2, v.base],
      );
    chunks.push(
      componentPython([detail], customInstances(p)),
      'axis_components.extend(components)',
      'axis_labels.extend(component_labels)',
      'axis_colors.extend(component_colors)',
      'axis_metadata.extend(component_metadata)',
    );
    chunks.push(
      'shape = Part.makeCompound(axis_components)',
      'component_labels = axis_labels',
      'component_colors = axis_colors',
      'component_metadata = axis_metadata',
    );
    return chunks.join('\n');
  },
  sources: [{ label: 'Supplied SFU dimensions', url: '' }, ...(guide.sources ?? [])],
  notes:
    'Prototype axis assembly. Screw/nut and MGN rail envelopes use the selected catalog rows; base, saddle, risers, support bearings and machined journals are custom layout geometry. End bearing rings represent clearances, not a bearing selection or load rating. Table travel is limited to clear both screw supports. Global Simple mode provides nominal thread and raceway envelopes; Full mode provides physical helical detail. Cutaway opens the housings for inspection.',
};
export default { ...part, presets: modulePresets };
