import presetData from './presets.json';
import type { Preset as ModulePreset } from '../../core/types';
const modulePresets = presetData as ModulePreset[];
import { Box3, Group, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import {
  n,
  num,
  numberParameter,
  ring,
  cylinder,
  annulusPython,
  compoundPython,
  DARK_STEEL,
} from '../../core/geometry';
import { BoundaryMesh, disposeModel } from '../../core/mechanical';
import { cageMesh, cagePython, type CageLayout } from './lib/parts/bearing-cage';
import { envelopeParameters, validateEnvelope } from './lib/parts/motion-bearing-utils';

/** Published light-series dimensions; supplier provenance is assigned by the catalog adapter. */
export function zarnReferenceDimensions(bore: number) {
  const table: Record<number, number[]> = {
    20: [31, 16, 42, 10],
    30: [35, 20, 52, 10],
    35: [37, 20, 60, 11],
    40: [37, 20, 65, 11],
    50: [42.5, 25, 78, 11.5],
  };
  const row = table[bore];
  return row
    ? { shoulderSpan: row[0], outerWidth: row[1], washerDiameter: row[2], washerThickness: row[3] }
    : undefined;
}

function values(p: Parameters, state: string) {
  const r = n(p, 'bore') / 2,
    R = n(p, 'outer') / 2,
    W = n(p, 'washerDiameter') / 2;
  const H = n(p, 'width'),
    C = n(p, 'outerWidth'),
    B = n(p, 'washerThickness');
  const band = W - r,
    clearance = Math.min(band, C) * 0.004;
  const sleeve = r + band * 0.18,
    needle = Math.min((W - sleeve) * 0.105, C * 0.085);
  const cavity = sleeve + needle * 2 + clearance * 2,
    needlePitch = sleeve + needle + clearance;
  const center = H / 2 - n(p, 'shoulderSpan') + C / 2;
  const axialInner = cavity + band * 0.04,
    axialOuter = W - band * 0.065;
  const rollerLength = axialOuter - axialInner,
    axialPitch = (axialInner + axialOuter) / 2;
  const offset = state === 'exploded' ? H * 0.45 : 0;
  const rows = [-1, 1].map((side) => {
    const face = center + (side * C) / 2,
      washerFace = side * (H / 2 - B);
    const gap = side * (washerFace - face),
      roller = gap * 0.48;
    return { side, gap, roller, z: (face + washerFace) / 2 + side * offset * 0.5 };
  });
  return {
    r,
    R,
    W,
    H,
    C,
    B,
    band,
    clearance,
    sleeve,
    needle,
    cavity,
    needlePitch,
    center,
    axialInner,
    axialOuter,
    rollerLength,
    axialPitch,
    offset,
    rows,
  };
}

function radialCage(p: Parameters): CageLayout {
  const v = values(p, 'assembled');
  return {
    pitch: v.needlePitch,
    radius: v.needle,
    count: n(p, 'needles'),
    center: v.center,
    halfWindow: v.C * 0.35,
    band: v.C * 0.02,
    rowPhase: 0,
  };
}

function axialCageValues(p: Parameters, row: ReturnType<typeof values>['rows'][number]) {
  const v = values(p, 'assembled'),
    margin = v.band * 0.025;
  const radii = [
    v.axialInner - margin * 2,
    v.axialInner - margin,
    v.axialOuter + margin,
    v.axialOuter + margin * 2,
  ];
  const beta = Math.asin((row.roller * 1.06) / radii[1]),
    count = n(p, 'axialRollers');
  const thickness = row.roller * 1.05;
  return { radii, beta, count, thickness };
}

/** Radial windows expose each axial roller while the inner and outer cage bands remain continuous. */
function axialCageMesh(p: Parameters, row: ReturnType<typeof values>['rows'][number]) {
  const v = axialCageValues(p, row),
    angles: number[] = [],
    mesh = new BoundaryMesh();
  for (let i = 0; i < v.count; i++) {
    const center = (i * Math.PI * 2) / v.count;
    for (let j = 0; j < 8; j++) angles.push(center - v.beta + (2 * v.beta * j) / 8);
    for (let j = 0; j < 4; j++)
      angles.push(center + v.beta + (((Math.PI * 2) / v.count - 2 * v.beta) * j) / 4);
  }
  const occupied = (radial: number, angular: number) =>
    radial >= 0 &&
    radial < 3 &&
    (radial !== 1 || (((angular % angles.length) + angles.length) % angles.length) % 12 >= 8);
  const point = (radius: number, angle: number, height: number) =>
    new Vector3(radius * Math.cos(angle), radius * Math.sin(angle), height);
  const lo = row.z - v.thickness / 2,
    hi = row.z + v.thickness / 2;
  for (let radial = 0; radial < 3; radial++)
    for (let angular = 0; angular < angles.length; angular++) {
      if (!occupied(radial, angular)) continue;
      const inner = v.radii[radial],
        outer = v.radii[radial + 1],
        a = angles[angular],
        b = angular + 1 === angles.length ? angles[0] + 2 * Math.PI : angles[angular + 1];
      for (const [z, sign] of [
        [lo, -1],
        [hi, 1],
      ])
        mesh.face(
          [point(inner, a, z), point(outer, a, z), point(outer, b, z), point(inner, b, z)],
          [],
          new Vector3(0, 0, sign),
        );
      for (const [adjacent, radius, sign] of [
        [radial - 1, inner, -1],
        [radial + 1, outer, 1],
      ])
        if (!occupied(adjacent, angular))
          mesh.face(
            [
              point(radius, a, lo),
              point(radius, b, lo),
              point(radius, b, hi),
              point(radius, a, hi),
            ],
            [],
            new Vector3(sign * Math.cos((a + b) / 2), sign * Math.sin((a + b) / 2), 0),
          );
      for (const [adjacent, angle, sign] of [
        [angular - 1, a, -1],
        [angular + 1, b, 1],
      ])
        if (!occupied(radial, adjacent))
          mesh.face(
            [
              point(inner, angle, lo),
              point(outer, angle, lo),
              point(outer, angle, hi),
              point(inner, angle, hi),
            ],
            [],
            new Vector3(-sign * Math.sin(angle), sign * Math.cos(angle), 0),
          );
    }
  const result = mesh.build(0x9b8b67);
  result.name = 'Axial roller cage';
  return result;
}

function axialCagePython(
  p: Parameters,
  row: ReturnType<typeof values>['rows'][number],
  name: string,
) {
  const v = axialCageValues(p, row),
    [inner, windowInner, windowOuter, outer] = v.radii;
  return `${name} = ${annulusPython(outer, inner, v.thickness, row.z - v.thickness / 2)}\nfor i in range(${v.count}):\n    angle = i * ${num((Math.PI * 2) / v.count)}\n    a = angle - ${num(v.beta)}\n    b = angle + ${num(v.beta)}\n    inner = ${num(windowInner)}\n    outer = ${num(windowOuter)}\n    z = ${num(row.z - v.thickness)}\n    points = [App.Vector(outer*math.cos(a+(b-a)*j/8),outer*math.sin(a+(b-a)*j/8),z) for j in range(9)] + [App.Vector(inner*math.cos(a+(b-a)*j/8),inner*math.sin(a+(b-a)*j/8),z) for j in range(8,-1,-1)]\n    window = Part.Face(Part.makePolygon(points+[points[0]])).extrude(App.Vector(0,0,${num(v.thickness * 2)}))\n    ${name} = ${name}.cut(window)\n${name} = ${name}.removeSplitter()`;
}

const defaults = {
  bore: 20,
  outer: 52,
  width: 46,
  ...zarnReferenceDimensions(20)!,
  needles: 18,
  axialRollers: 12,
};
const part: PartDefinition = {
  id: 'zarn-bearing',
  name: 'Combined needle and thrust roller bearing',
  category: 'BEARINGS & SEALS',
  subgroup: 'COMBINED BEARINGS',
  icon: 'bearing',
  complexity: 'Radial needles + two thrust rows',
  standard: 'ZARN reference',
  description:
    'A ZARN-style bearing with a through-bore inner race, radial needles and opposing axial cylindrical roller sets.',
  keywords: [
    'ZARN',
    'ZARN2052',
    'ZARN3570',
    'ZARN4075',
    'screw drive',
    'combined',
    'needle',
    'axial roller',
    'double direction',
  ],
  defaults,
  presets: modulePresets,
  presetMatchKeys: ['bore', 'outer', 'width'],
  parameters: [
    ...envelopeParameters,
    {
      ...numberParameter(
        'shoulderSpan',
        'Outer face to opposite shaft face',
        'H₁',
        'Race dimensions',
        1,
        250,
      ),
      description:
        'Distance from the lower outer-ring face to the upper shaft-washer face, as in the supplier drawing.',
    },
    numberParameter('outerWidth', 'Central outer ring width', 'C', 'Race dimensions', 1, 150),
    numberParameter(
      'washerDiameter',
      'Shaft washer outside diameter',
      'D₁',
      'Race dimensions',
      3,
      500,
    ),
    numberParameter('washerThickness', 'Shaft washer thickness', 'B', 'Race dimensions', 0.5, 60),
    {
      ...numberParameter(
        'needles',
        'Illustrative radial needle count',
        'nᵣ',
        'Internal layout',
        6,
        80,
        1,
      ),
      unit: '',
    },
    {
      ...numberParameter(
        'axialRollers',
        'Illustrative rollers per thrust row',
        'nₐ',
        'Internal layout',
        4,
        50,
        1,
      ),
      unit: '',
    },
  ],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Full bearing with two opposing axial roller rows.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Shaft washers and thrust rows moved apart to reveal the internal arrangement.',
    },
    {
      id: 'internals',
      label: 'Internal mechanism',
      description: 'Central outer ring and shaft washers hidden to expose all three roller sets.',
    },
  ],
  validate(p) {
    const errors = validateEnvelope(p),
      v = values(p, 'assembled');
    if (v.W <= v.r + 1 || v.W >= v.R)
      errors.push('Shaft washers must fit between the bore and central outer diameter.');
    if (v.H <= v.C + 2 * v.B + 0.4)
      errors.push(
        'Two shaft washers and the central ring must leave positive axial roller spaces.',
      );
    if (v.rows.some((row) => row.gap <= 0.2))
      errors.push('H₁ must leave an axial roller space on both sides of the central ring.');
    if (v.rollerLength <= 0.5)
      errors.push('The shaft washer diameter must leave room for axial roller tracks.');
    for (const key of ['needles', 'axialRollers'])
      if (!Number.isInteger(n(p, key))) errors.push('Rolling element counts must be integers.');
    if (2 * v.needlePitch * Math.sin(Math.PI / n(p, 'needles')) <= v.needle * 2.3)
      errors.push('Reduce the needle count to leave cage clearances.');
    for (const row of v.rows) {
      const cage = axialCageValues(p, row);
      if (!Number.isFinite(cage.beta) || cage.beta >= (Math.PI / n(p, 'axialRollers')) * 0.95)
        errors.push(
          'Reduce the axial roller count or axial roller gap to leave clear cage windows.',
        );
      if (Math.hypot(v.axialOuter, row.roller) >= v.W - v.clearance)
        errors.push('Axial rollers must remain inside the shaft washer diameter.');
      if (row.roller * 2 >= v.rollerLength * 1.8)
        errors.push('The axial roller gap is too large for the available radial track.');
    }
    return errors;
  },
  buildGeometry(p, state) {
    const v = values(p, state),
      group = new Group();
    const sleeve = ring(v.sleeve, v.r, v.H - 2 * v.B - 2 * v.clearance);
    sleeve.name = 'Inner needle race';
    group.add(sleeve);
    if (state !== 'internals') {
      const outer = ring(v.R, v.cavity, v.C);
      outer.name = 'Central outer race';
      outer.position.z = v.center;
      group.add(outer);
      for (const side of [-1, 1]) {
        const washer = ring(v.W, v.r, v.B);
        washer.name = 'Shaft thrust washer';
        washer.position.z = side * ((v.H - v.B) / 2 + v.offset);
        group.add(washer);
      }
    }
    group.add(cageMesh(radialCage(p)));
    for (let i = 0; i < n(p, 'needles'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'needles'),
        needle = cylinder(v.needle, v.C * 0.68, DARK_STEEL);
      needle.position.set(v.needlePitch * Math.cos(a), v.needlePitch * Math.sin(a), v.center);
      needle.name = 'Radial needle';
      group.add(needle);
    }
    for (const row of v.rows) {
      group.add(axialCageMesh(p, row));
      for (let i = 0; i < n(p, 'axialRollers'); i++) {
        const a = (i * Math.PI * 2) / n(p, 'axialRollers'),
          direction = new Vector3(Math.cos(a), Math.sin(a), 0),
          roller = cylinder(row.roller, v.rollerLength, DARK_STEEL);
        roller.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), direction);
        roller.position.set(direction.x * v.axialPitch, direction.y * v.axialPitch, row.z);
        roller.name = 'Axial cylindrical roller';
        group.add(roller);
      }
    }
    return group;
  },
  python(p, state) {
    const v = values(p, state),
      shapes = [annulusPython(v.sleeve, v.r, v.H - 2 * v.B - 2 * v.clearance)],
      setup = [cagePython(radialCage(p), 'radial_cage')];
    shapes.push('radial_cage');
    if (state !== 'internals') {
      shapes.push(annulusPython(v.R, v.cavity, v.C, v.center - v.C / 2));
      for (const side of [-1, 1])
        shapes.push(annulusPython(v.W, v.r, v.B, side * ((v.H - v.B) / 2 + v.offset) - v.B / 2));
    }
    for (let i = 0; i < n(p, 'needles'); i++) {
      const a = (i * Math.PI * 2) / n(p, 'needles');
      shapes.push(
        `Part.makeCylinder(${num(v.needle)},${num(v.C * 0.68)},App.Vector(${num(v.needlePitch * Math.cos(a))},${num(v.needlePitch * Math.sin(a))},${num(v.center - v.C * 0.34)}))`,
      );
    }
    v.rows.forEach((row, j) => {
      setup.push(axialCagePython(p, row, `axial_cage_${j}`));
      shapes.push(`axial_cage_${j}`);
      for (let i = 0; i < n(p, 'axialRollers'); i++) {
        const a = (i * Math.PI * 2) / n(p, 'axialRollers');
        shapes.push(
          `Part.makeCylinder(${num(row.roller)},${num(v.rollerLength)},App.Vector(${num(v.axialInner * Math.cos(a))},${num(v.axialInner * Math.sin(a))},${num(row.z)}),App.Vector(${num(Math.cos(a))},${num(Math.sin(a))},0))`,
        );
      }
    });
    return [...setup, compoundPython(shapes)].join('\n');
  },
  dimensions(p, state) {
    const model = part.buildGeometry(p, state);
    const size = new Box3().setFromObject(model, true).getSize(new Vector3());
    disposeModel(model);
    return [size.x, size.y, size.z];
  },
  notes:
    'ZARN layout follows the Schaeffler section: a radial needle bearing between two opposing axial cylindrical roller sets, shaft washers and a continuous through-bore race. Only marked supplier dimensions are verified. Needle diameter/count, cylindrical roller profiles/counts, cage windows, internal race diameter and small assembly clearances are illustrative prototype geometry. This model does not reproduce preload, manufacturing tolerances or load capacity.',
  sources: [
    {
      label: 'Promtehimport · combined bearings',
      url: 'https://promtehimport.com.ua/kombinovani-pidshipniki-c48/',
    },
    {
      label: 'Schaeffler · Bearings for Screw Drives, ZARN section',
      url: 'https://www.schaeffler.com/remotemedien/media/_shared_media/08_media_library/01_publications/schaeffler_2/tpi/downloads_8/tpi123_de_en.pdf',
    },
  ],
};

export default { ...part, presets: modulePresets };
