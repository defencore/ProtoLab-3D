import type { PartDefinition, Parameters, Preset } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import detail from '../../manufactured-detail/part';
import screw from '../../bolt-screw/part';
import nut from '../../hex-nut/part';

export const libraries: PartDefinition[] = [detail, screw, nut];
const exact = (part: PartDefinition, id: string): Preset => {
  const preset = part.presets.find((candidate) => candidate.id === id);
  if (!preset?.catalog)
    throw new Error('Missing sourced enclosure hardware: ' + part.id + ':' + id);
  return preset;
};
export const nutPreset = exact(nut, 'gvyntok-474adfbe1cd7');
export const screwPresets = {
  socket: exact(screw, 'gvyntok-040-190-006'),
  countersunk: exact(screw, 'gvyntok-040-070-005'),
};

/** Keep the selected sourced head, lid bearing web and captive-nut roof compatible. */
export function supportedLidRange(p: Parameters, style: 'socket' | 'countersunk') {
  const selected = screwPresets[style],
    head = Number(selected.parameters.headHeight),
    total = Number(selected.parameters.length) + (style === 'socket' ? head : 0),
    wall = Number(p.wall),
    recess = Number(p.headRecess),
    pitch = Number(selected.parameters.pitch);
  return {
    min: Math.ceil(Math.max(5.5, wall + recess + head) * 10 - 1e-8) / 10,
    max:
      Math.floor(
        Math.min(9, total + recess - 2 * pitch - Number(nutPreset.parameters.height) - wall) * 10 +
          1e-8,
      ) / 10,
  };
}

export function layout(p: Parameters) {
  const width = Number(p.width),
    depth = Number(p.depth),
    height = Number(p.height),
    wall = Number(p.wall),
    lidThickness = Number(p.lidThickness),
    bossWidth = Number(p.bossWidth),
    headRecess = Number(p.headRecess),
    holeClearance = Number(p.holeClearance),
    nutClearance = Number(p.nutClearance),
    pocketClearance = Number(p.pocketClearance),
    headClearance = Number(p.headClearance),
    selected = p.headStyle === 'countersunk' ? screwPresets.countersunk : screwPresets.socket,
    headHeight = Number(selected.parameters.headHeight),
    headRadius = Number(selected.parameters.headSize) / 2,
    diameter = Number(selected.parameters.diameter),
    pitch = Number(selected.parameters.pitch),
    nutHeight = Number(nutPreset.parameters.height),
    nutAF = Number(nutPreset.parameters.acrossFlats),
    totalLength =
      Number(selected.parameters.length) + (p.headStyle === 'countersunk' ? 0 : headHeight),
    headTop = height + lidThickness - headRecess,
    tip = headTop - totalLength,
    nutBottom = tip + 2 * pitch,
    nutTop = nutBottom + nutHeight,
    nutPocketBottom = nutBottom - pocketClearance,
    nutPocketTop = nutTop,
    headBottom = headTop - headHeight,
    roof = height - nutPocketTop,
    inset = wall + bossWidth / 2 - 1,
    centers = [-1, 1].flatMap((x) =>
      [-1, 1].map((y): [number, number] => [x * (width / 2 - inset), y * (depth / 2 - inset)]),
    );
  return {
    width,
    depth,
    height,
    wall,
    lidThickness,
    bossWidth,
    headRecess,
    holeClearance,
    nutClearance,
    pocketClearance,
    headClearance,
    selected,
    headHeight,
    headRadius,
    diameter,
    pitch,
    nutHeight,
    nutAF,
    totalLength,
    headTop,
    headBottom,
    tip,
    nutBottom,
    nutTop,
    nutPocketBottom,
    nutPocketTop,
    roof,
    inset,
    centers,
    holeRadius: (diameter + holeClearance) / 2,
    pocketAF: nutAF + nutClearance,
    lidSeatWeb: lidThickness - headRecess - headHeight,
  };
}

export function hexPocket(p: Parameters, x: number, y: number): Shape {
  const d = layout(p),
    radius = d.pocketAF / Math.sqrt(3);
  return prism(
    Array.from({ length: 6 }, (_, i): [number, number] => [
      x + radius * Math.cos((i * Math.PI) / 3),
      y + radius * Math.sin((i * Math.PI) / 3),
    ]),
    d.nutPocketTop - d.nutPocketBottom,
    d.nutPocketBottom,
  );
}

export function printedShapes(p: Parameters): [Shape, Shape] {
  const d = layout(p);
  const shell = subtract(
    box([d.width, d.depth, d.height], [-d.width / 2, -d.depth / 2, 0]),
    box(
      [d.width - 2 * d.wall, d.depth - 2 * d.wall, d.height],
      [-d.width / 2 + d.wall, -d.depth / 2 + d.wall, d.wall],
    ),
  );
  const base = subtract(
    union(
      shell,
      ...d.centers.map(([x, y]) =>
        box(
          [d.bossWidth, d.bossWidth, d.height - d.wall],
          [x - d.bossWidth / 2, y - d.bossWidth / 2, d.wall],
        ),
      ),
    ),
    ...d.centers.flatMap(([x, y]) => [
      cylinder(d.holeRadius, d.height + 1 - d.wall, [x, y, d.wall]),
      hexPocket(p, x, y),
      box(
        [Math.abs(x) + 0.5, d.pocketAF, d.nutPocketTop - d.nutPocketBottom],
        [x < 0 ? x : -0.5, y - d.pocketAF / 2, d.nutPocketBottom],
      ),
    ]),
  );
  const lidTop = d.lidThickness - d.headRecess,
    headBottom = lidTop - d.headHeight;
  const seats = d.centers.flatMap(([x, y]): Shape[] => {
    const through = cylinder(d.holeRadius, d.lidThickness + 2, [x, y, -1]);
    if (p.headStyle !== 'countersunk')
      return [
        through,
        cylinder(d.headRadius + d.headClearance, d.lidThickness + 1 - headBottom, [
          x,
          y,
          headBottom,
        ]),
      ];
    const coneHeight = Math.min(
      d.headHeight,
      (d.headRadius - d.diameter / 2) /
        Math.tan((Number(d.selected.parameters.countersinkAngle) * Math.PI) / 360),
    );
    const cone: Shape = {
      kind: 'transform',
      translation: [x, y, 0],
      rotation: [0, 0, 0],
      child: {
        kind: 'revolve',
        profile: [
          [0, headBottom],
          [d.headRadius - coneHeight, headBottom],
          [d.headRadius, headBottom + coneHeight],
          [d.headRadius, d.lidThickness + 1],
          [0, d.lidThickness + 1],
        ],
      },
    };
    return [
      through,
      cone,
      cylinder(d.headRadius + d.headClearance, d.lidThickness + 1 - (headBottom + coneHeight), [
        x,
        y,
        headBottom + coneHeight,
      ]),
    ];
  });
  const lid = subtract(
    box([d.width, d.depth, d.lidThickness], [-d.width / 2, -d.depth / 2, 0]),
    ...seats,
  );
  return [base, lid];
}

function hardware(
  part: PartDefinition,
  preset: Preset,
  id: string,
  name: string,
  translation: Vec,
): AssemblyComponent {
  return {
    id,
    name,
    libraryId: part.id,
    presetId: preset.id,
    parameters: { ...preset.parameters },
    state: 'default',
    quantity: 1,
    // Source hex-nut vertices start at 30 degrees. Clock both thread members
    // together so the nut presents its across-flats width to the X entry slot.
    placement: { translation, rotation: [0, 0, -30] },
    supply: 'standard',
    procurement: {
      name: preset.catalog!.name,
      designation: preset.catalog!.designation,
      standard: preset.catalog!.standard,
      manufacturer: preset.catalog!.manufacturer ?? '',
      source: preset.catalog!.sourceUrl,
    },
  };
}

export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  const printed = printedShapes(p).map((shape, index) => {
    const component = detailComponent(
      index === 0 ? 'base' : 'lid',
      index === 0
        ? 'Printed screw enclosure body with nut traps'
        : 'Printed lid with recessed screw seats',
      shape,
      { preserveAuthoredFrame: true },
    );
    component.placement.translation = [0, 0, index === 0 ? 0 : d.height];
    component.manufacturing = {
      material: 'Specify and qualify the actual printing polymer grade',
      blank: 'Separately printed enclosure part',
      processes: ['printing'],
      requirements: [
        'Print the body floor down and the lid flat underside down; inspect nut trap roofs, side entries and head seats.',
        'Qualify layer adhesion, bridging, pocket dimensions, screw torque, lid flatness and creep on the actual printer and material.',
      ],
    };
    return component;
  });
  return [
    ...printed,
    ...d.centers.flatMap(([x, y], index) => [
      hardware(screw, d.selected, `screw-${index + 1}`, `M3 lid screw ${index + 1}`, [
        x,
        y,
        d.headTop - d.totalLength / 2,
      ]),
      hardware(nut, nutPreset, `nut-${index + 1}`, `M3 side-loaded captive nut ${index + 1}`, [
        x,
        y,
        d.nutBottom,
      ]),
    ]),
  ];
}

export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: components(p),
    issues: [
      'Empty enclosure template. Lay out the actual electronics, connectors, cables and thermal interfaces before modifying or releasing it.',
      'Qualify nut capture, side-loading access, layer strength, screw torque, creep and working loads. No sealing, IP or structural rating is assigned.',
    ],
  };
}

export function pieces(p: Parameters, state: string, printingExport = false): ConfiguredPiece[] {
  const d = layout(p);
  return components(p)
    .filter(
      (component) => !(state === 'print' || printingExport) || component.supply === 'manufactured',
    )
    .map((source, index) => {
      const component = {
        ...source,
        placement: {
          translation: [...source.placement.translation] as Vec,
          rotation: [...source.placement.rotation] as Vec,
        },
      };
      let position: Vec = [0, 0, 0];
      if (state === 'print' && component.id === 'lid')
        component.placement.translation = [0, d.depth + 8, 0];
      if (state === 'exploded') {
        if (component.id === 'lid') position = [0, 0, 20];
        else if (component.id.startsWith('screw')) position = [0, 0, 32];
        else if (component.id.startsWith('nut')) position = [0, 0, -d.nutTop - 8];
      }
      return {
        component,
        label: component.name,
        color: index < 2 ? (index === 0 ? 0x478c99 : 0xe6a34a) : 0xb3bdc7,
        position,
        requireSingleSolid: true,
      };
    });
}
