import { cageMesh, cagePython, type CageLayout } from './bearing-cage';
import { Group, LatheGeometry, Mesh, Quaternion, Vector2, Vector3 } from 'three';
import {
  annulusPython,
  compoundPython,
  cylinder,
  DARK_STEEL,
  material,
  n,
  num,
  ring,
  sphere,
} from '../../../../core/geometry';
import type { Parameters } from '../../../../core/types';
import type { RadialFamily } from '../catalog/radial-bearings';

type Profile = [number, number][];

function revolved(profile: Profile, color = 0x85898e) {
  const closed = [...profile, profile[0]];
  const geometry = new LatheGeometry(
    closed.map(([r, z]) => new Vector2(r, z)),
    96,
  );
  // Faces touching the rotation axis need a fan, not collapsed quad triangles.
  const positions = geometry.getAttribute('position');
  const original = geometry.getIndex()!;
  const indices: number[] = [];
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  for (let i = 0; i < original.count; i += 3) {
    const ids = [original.getX(i), original.getX(i + 1), original.getX(i + 2)];
    a.fromBufferAttribute(positions, ids[0]);
    b.fromBufferAttribute(positions, ids[1]);
    c.fromBufferAttribute(positions, ids[2]);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18) indices.push(...ids);
  }
  geometry.setIndex(indices);
  geometry.rotateX(Math.PI / 2);
  return new Mesh(geometry, material(color));
}

function revolvePython(profile: Profile, zOffset = 0) {
  const vertices = [...profile, profile[0]].map(
    ([r, z]) => `App.Vector(${num(r)}, 0, ${num(z + zOffset)})`,
  );
  return `Part.Face(Part.makePolygon([${vertices.join(', ')}])).revolve(App.Vector(0, 0, 0), App.Vector(0, 0, 1), 360)`;
}

export function radialVisualSizes(p: Parameters, family: RadialFamily) {
  const bore = n(p, 'bore') / 2,
    outer = n(p, 'outer') / 2,
    width = n(p, 'width'),
    gap = outer - bore;
  const double = ['double-row', 'self-aligning', 'spherical'].includes(family);
  const count = Number(p.elements ?? p.balls ?? p.rollers);
  const radius = Math.min(
    gap *
      (family === 'needle'
        ? 0.33
        : family === 'cylindrical'
          ? 0.225
          : ['ball', 'angular', 'double-row'].includes(family)
            ? 0.255
            : 0.19),
    width * (double ? 0.18 : 0.3),
  );
  const pitch = family === 'needle' ? bore + radius : (bore + outer) / 2;
  return { bore, outer, width, gap, double, radius, pitch, count };
}
const sizes = radialVisualSizes;
function hasNeedleSeals(p: Parameters, family: RadialFamily) {
  return family === 'needle' && p.seals === 'rubber';
}

function needleSealProfile(p: Parameters, sign: number): Profile {
  const { bore: r, gap: g, width: w } = sizes(p, 'needle');
  // The inward lip reaches Fw. Its outer body sits behind the cup's retaining rim.
  const profile: Profile = [
    [r + g * 0.765, w * 0.375],
    [r + g * 0.765, w * 0.455],
    [r + g * 0.16, w * 0.455],
    [r + g * 0.02, w * 0.47],
    [r, w * 0.46],
    [r, w * 0.43],
    [r + g * 0.15, w * 0.37],
  ];
  return sign > 0 ? profile : profile.map(([r, z]): [number, number] => [r, -z]).reverse();
}

function ballRaces(p: Parameters, family: RadialFamily): Profile[] {
  const v = sizes(p, family),
    r = v.bore,
    R = v.outer,
    w = v.width,
    g = v.gap;
  const rows = v.double ? [-w * 0.23, w * 0.23] : [0],
    clear = Math.min(g, w) * 0.005,
    groove = v.radius + clear;
  const inner: Profile = [],
    outer: Profile = [];
  // Opposite low shoulders distinguish angular contact bearings from symmetric deep grooves.
  const contact = family === 'angular' ? Math.sin((n(p, 'contactAngle') * Math.PI) / 180) : 0;
  for (let i = 0; i <= 96; i++) {
    const z = w * (i / 96 - 0.5),
      chamfer = Math.min(g, w) * 0.035;
    let innerR = r + g * (0.39 + (family === 'angular' ? (contact * 0.1 * z) / (w / 2) : 0));
    let outerR = R - g * (0.39 - (family === 'angular' ? (contact * 0.1 * z) / (w / 2) : 0));
    for (const row of rows) {
      const distance = Math.abs(z - row);
      if (distance < groove) {
        const reach = Math.sqrt(groove * groove - distance * distance);
        innerR = Math.min(innerR, v.pitch - reach);
        outerR = Math.max(outerR, v.pitch + reach);
      }
    }
    if (Math.abs(z) > w / 2 - chamfer) {
      innerR -= Math.abs(z) - (w / 2 - chamfer);
      outerR += Math.abs(z) - (w / 2 - chamfer);
    }
    inner.push([innerR, z]);
    outer.push([outerR, z]);
  }
  return [
    [[r, -w / 2], ...inner, [r, w / 2]],
    [[R, -w / 2], [R, w / 2], ...outer.reverse()],
  ];
}

function races(p: Parameters, family: RadialFamily): Profile[] {
  const { bore: r, outer: R, width: w, gap: g, radius } = sizes(p, family);
  const z = w / 2;
  if (['ball', 'double-row', 'angular'].includes(family)) return ballRaces(p, family);
  if (family === 'cylindrical') {
    const inside = r + g * 0.275,
      outside = R - g * 0.275,
      innerLip = r + g * 0.44,
      outerLip = r + g * 0.56,
      t = w * 0.09;
    const kind = String(p.ribs ?? 'NU');
    const innerLow = ['N', 'NJ', 'NUP'].includes(kind),
      innerHigh = ['N', 'NUP'].includes(kind),
      outerRibs = kind !== 'N';
    const inner: Profile = [
      [r, -z],
      [innerLow ? innerLip : inside, -z],
    ];
    if (innerLow) inner.push([innerLip, -z + t], [inside, -z + t]);
    if (innerHigh) inner.push([inside, z - t], [innerLip, z - t]);
    inner.push([innerHigh ? innerLip : inside, z], [r, z]);
    const outer: Profile = outerRibs
      ? [
          [R, -z],
          [R, z],
          [outerLip, z],
          [outerLip, z - t],
          [outside, z - t],
          [outside, -z + t],
          [outerLip, -z + t],
          [outerLip, -z],
        ]
      : [
          [R, -z],
          [R, z],
          [outside, z],
          [outside, -z],
        ];
    return [inner, outer];
  }
  if (family === 'needle')
    return [
      hasNeedleSeals(p, family)
        ? [
            [R, -z],
            [R, z],
            [r + g * 0.55, z],
            [r + g * 0.55, w * 0.465],
            [r + g * 0.78, w * 0.465],
            [r + g * 0.78, -w * 0.465],
            [r + g * 0.55, -w * 0.465],
            [r + g * 0.55, -z],
          ]
        : [
            [R, -z],
            [R, z],
            [r + radius * 0.12, z],
            [r + radius * 0.12, z - w * 0.08],
            [r + g * 0.78, z - w * 0.08],
            [r + g * 0.78, -z + w * 0.08],
            [r + radius * 0.12, -z + w * 0.08],
            [r + radius * 0.12, -z],
          ],
    ];
  if (family === 'tapered')
    return [
      [
        [r, -z],
        [r + g * 0.22, -z],
        [r + g * 0.34, z],
        [r, z],
      ],
      [
        [R, -z],
        [R, z],
        [R - g * 0.18, z],
        [R - g * 0.32, -z],
      ],
    ];
  if (family === 'self-aligning' || family === 'spherical') {
    const v = sizes(p, family);
    const taper = p.boreType === 'taper12' ? 12 : p.boreType === 'taper30' ? 30 : 0;
    const seat =
      family === 'self-aligning'
        ? Math.hypot(v.pitch, w * 0.23) + radius + Math.min(g, w) * 0.015
        : R - g * 0.16;
    const cavity: Profile = Array.from({ length: 49 }, (_, i) => {
      const axial = z - (i * w) / 48;
      return [Math.sqrt(Math.max((r + g * 0.55) ** 2, seat * seat - axial * axial)), axial];
    });
    return [
      [
        [r, -z],
        [r + g * 0.27, -z],
        [r + g * 0.27, z],
        [r + (taper ? w / (2 * taper) : 0), z],
      ],
      [[R, -z], [R, z], ...cavity],
    ];
  }
  return [
    [
      [r, -z],
      [r + g * 0.27, -z],
      [r + g * 0.27, z],
      [r, z],
    ],
    [
      [R, -z],
      [R, z],
      [R - g * 0.27, z],
      [R - g * 0.27, -z],
    ],
  ];
}

function barrelProfile(radius: number, length: number): Profile {
  return [
    [0, -length / 2],
    ...Array.from({ length: 13 }, (_, i): [number, number] => {
      const t = i / 12;
      return [radius * (0.78 + 0.22 * Math.sin(t * Math.PI)), (t - 0.5) * length];
    }),
    [0, length / 2],
  ];
}

function cageLayout(p: Parameters, family: RadialFamily, center: number, row: number): CageLayout {
  const v = sizes(p, family),
    longRoller = ['needle', 'cylindrical', 'tapered'].includes(family);
  return {
    pitch: v.pitch,
    radius: v.radius,
    count: v.count,
    center,
    halfWindow: hasNeedleSeals(p, family)
      ? v.width * 0.318
      : longRoller
        ? v.width * 0.398
        : family === 'spherical'
          ? (v.width * 0.16 + v.radius * 0.13) / Math.hypot(1, 0.13) + v.width * 0.008
          : v.radius * 1.03,
    band: longRoller || family === 'spherical' ? v.width * 0.018 : v.radius * 0.075,
    rowPhase: (row * 0.5 * Math.PI * 2) / v.count,
  };
}
export function validateRadial(p: Parameters, family: RadialFamily) {
  const errors: string[] = [];
  const { bore, outer, radius, pitch } = sizes(p, family);
  if (outer - bore <= 0.2) errors.push('Outer diameter must exceed the bore by more than 0.4 mm.');
  const count = sizes(p, family).count;
  if (['self-aligning', 'spherical'].includes(family) && p.boreType !== 'straight') {
    const taper = p.boreType === 'taper12' ? 12 : p.boreType === 'taper30' ? 30 : 0;
    if (taper && n(p, 'width') / (2 * taper) >= (outer - bore) * 0.255)
      errors.push('The large end of the tapered bore must leave material inside the inner race.');
  }
  if (family === 'self-aligning') {
    const v = sizes(p, family);
    if (
      Math.hypot(v.pitch, v.width * 0.23) + v.radius + Math.min(v.gap, v.width) * 0.015 >=
      v.outer - 0.02 * v.gap
    )
      errors.push('The spherical common raceway must fit inside the outer ring.');
  }
  if (!Number.isInteger(count)) errors.push('Rolling element count must be a whole number.');
  if (count > 2 && 2 * pitch * Math.sin(Math.PI / count) <= radius * 2.3)
    errors.push('Too many rolling elements for this envelope. Reduce the element count.');
  return errors;
}

export function radialGeometry(p: Parameters, state: string, family: RadialFamily): Group {
  const group = new Group();
  const { bore, outer, width, double, radius, pitch } = sizes(p, family);
  const offset =
    state === 'exploded'
      ? width * (family === 'needle' && !hasNeedleSeals(p, family) ? 0.95 : 0.9)
      : 0;
  const profiles = races(p, family);
  profiles.forEach((profile, index) => {
    const race = revolved(profile);
    race.position.z = profiles.length === 1 ? offset : index === 0 ? -offset : offset;
    group.add(race);
  });
  const rowOffsets = double ? [-width * 0.23, width * 0.23] : [0];
  rowOffsets.forEach((z, row) => {
    group.add(cageMesh(cageLayout(p, family, z, row)));
    for (let i = 0; i < sizes(p, family).count; i++) {
      const a = ((i + row * 0.5) * Math.PI * 2) / sizes(p, family).count;
      const position = new Vector3(Math.cos(a) * pitch, Math.sin(a) * pitch, z);
      let mesh: Mesh;
      if (family === 'needle' || family === 'cylindrical')
        mesh = cylinder(radius, width * (hasNeedleSeals(p, family) ? 0.6 : 0.76), DARK_STEEL);
      else if (family === 'spherical') {
        mesh = revolved(barrelProfile(radius, width * 0.32), DARK_STEEL);
        const tilt = (row === 0 ? 1 : -1) * 0.13;
        const axis = new Vector3(Math.cos(a) * tilt, Math.sin(a) * tilt, 1).normalize();
        mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis));
      } else if (family === 'tapered') {
        mesh = revolved(
          [
            [0, -width * 0.36],
            [radius * 0.7, -width * 0.36],
            [radius, width * 0.36],
            [0, width * 0.36],
          ],
          DARK_STEEL,
        );
        const axis = new Vector3(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 1).normalize();
        mesh.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), axis));
      } else mesh = sphere(radius, DARK_STEEL);
      mesh.position.copy(position);
      group.add(mesh);
    }
  });
  if (hasNeedleSeals(p, family)) {
    for (const sign of [-1, 1]) {
      const seal = revolved(needleSealProfile(p, sign), 0x292d31);
      seal.position.z = offset;
      group.add(seal);
    }
  } else if (p.seals && p.seals !== 'open') {
    for (const sign of String(p.seals).endsWith('-one') ? [1] : [-1, 1]) {
      const seal = ring(
        outer - (outer - bore) * 0.4,
        bore + (outer - bore) * 0.4,
        width * 0.05,
        String(p.seals).startsWith('metal') ? 0xa0a6ac : 0x292d31,
      );
      seal.position.z = sign * (width * 0.455 + offset);
      group.add(seal);
    }
  }
  return group;
}

export function radialPython(p: Parameters, state: string, family: RadialFamily): string {
  const { bore, outer, width, double, radius, pitch } = sizes(p, family);
  const offset =
    state === 'exploded'
      ? width * (family === 'needle' && !hasNeedleSeals(p, family) ? 0.95 : 0.9)
      : 0;
  const profiles = races(p, family);
  const shapes = profiles.map((profile, index) =>
    revolvePython(profile, profiles.length === 1 ? offset : index === 0 ? -offset : offset),
  );
  const labels = profiles.length === 1 ? ['Outer ring'] : ['Inner ring', 'Outer ring'];
  const colors = profiles.map(() => [0.62, 0.7, 0.78]);
  const setup: string[] = [];
  const rowOffsets = double ? [-width * 0.23, width * 0.23] : [0];
  rowOffsets.forEach((z, row) => {
    setup.push(cagePython(cageLayout(p, family, z, row), `cage_${row}`));
    shapes.push(`cage_${row}`);
    labels.push(`Cage ${row + 1}`);
    colors.push([0.72, 0.53, 0.27]);
    for (let i = 0; i < sizes(p, family).count; i++) {
      const roller = ['needle', 'cylindrical', 'spherical', 'tapered'].includes(family);
      labels.push(`${roller ? 'Roller' : 'Ball'} ${row + 1}.${i + 1}`);
      colors.push([0.75, 0.78, 0.82]);
      const a = ((i + row * 0.5) * Math.PI * 2) / sizes(p, family).count;
      const x = Math.cos(a) * pitch,
        y = Math.sin(a) * pitch;
      const v = `App.Vector(${num(x)}, ${num(y)}, ${num(z)})`;
      if (family === 'needle' || family === 'cylindrical') {
        const length = width * (hasNeedleSeals(p, family) ? 0.6 : 0.76);
        shapes.push(
          `Part.makeCylinder(${num(radius)}, ${num(length)}, App.Vector(${num(x)}, ${num(y)}, ${num(-length / 2)}))`,
        );
      } else if (family === 'spherical' || family === 'tapered') {
        const profile =
          family === 'spherical'
            ? barrelProfile(radius, width * 0.32)
            : ([
                [0, -width * 0.36],
                [radius * 0.7, -width * 0.36],
                [radius, width * 0.36],
                [0, width * 0.36],
              ] as Profile);
        const tilt = family === 'spherical' ? (row === 0 ? 1 : -1) * 0.13 : 0.1;
        const rotation = (Math.atan(tilt) * 180) / Math.PI;
        const id = `roller_${row}_${i}`;
        setup.push(
          `${id} = ${revolvePython(profile)}\n${id}.rotate(App.Vector(0, 0, 0), App.Vector(${num(-Math.sin(a))}, ${num(Math.cos(a))}, 0), ${num(rotation)})\n${id}.translate(${v})`,
        );
        shapes.push(id);
      } else shapes.push(`Part.makeSphere(${num(radius)}, ${v})`);
    }
  });
  if (hasNeedleSeals(p, family)) {
    for (const sign of [-1, 1]) {
      shapes.push(revolvePython(needleSealProfile(p, sign), offset));
      labels.push(sign < 0 ? 'Rear seal' : 'Front seal');
      colors.push([0.15, 0.18, 0.22]);
    }
  } else if (p.seals && p.seals !== 'open')
    for (const sign of String(p.seals).endsWith('-one') ? [1] : [-1, 1]) {
      shapes.push(
        annulusPython(
          outer - (outer - bore) * 0.4,
          bore + (outer - bore) * 0.4,
          width * 0.05,
          sign * (width * 0.455 + offset) - width * 0.025,
        ),
      );
      const rubber = String(p.seals).startsWith('rubber');
      labels.push(`${sign < 0 ? 'Rear' : 'Front'} ${rubber ? 'seal' : 'shield'}`);
      colors.push(rubber ? [0.15, 0.18, 0.22] : [0.62, 0.65, 0.69]);
    }
  return [
    ...setup,
    compoundPython(shapes),
    `component_labels = ${JSON.stringify(labels)}`,
    `component_colors = ${JSON.stringify(colors)}`,
  ].join('\n');
}

export function radialDimensions(
  p: Parameters,
  state: string,
  family: RadialFamily,
): [number, number, number] {
  const width = n(p, 'width');
  // A drawn cup has only an outer shell; its needle cage stays at the assembly origin when exploded.
  const factor =
    state === 'exploded'
      ? family === 'needle'
        ? hasNeedleSeals(p, family)
          ? 1.736
          : 1.866
        : 2.8
      : 1;
  return [n(p, 'outer'), n(p, 'outer'), width * factor];
}
