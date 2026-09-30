import { Group, Vector2 } from 'three';
import { n, numberParameter, ring, num } from '../../../../core/geometry';
import {
  outline,
  polygonPython,
  type ShellSection,
  modelBounds,
  removeDegenerateTriangles,
} from './hardware';
import { turnedMesh, turnedPython, type TurnedProfile } from '../parts/motion-bearing-utils';
import type { Parameters, PartDefinition } from '../../../../core/types';
import {
  internalThreadDefaults,
  internalThreadParameters,
  internalThreadErrors,
  nominalThreadDiameter,
  threadedShellMesh,
  internalThreadPython,
  nutCoarsePitch,
} from './internal-thread';

export type NutStyle = 'hex' | 'square' | 'flange' | 'nyloc' | 'cap';

export function nutDefinition(
  id: string,
  name: string,
  standard: string,
  style: NutStyle,
  defaults: Parameters,
): PartDefinition {
  defaults = { ...internalThreadDefaults(Number(defaults.bore)), ...defaults };
  const sections = (p: Parameters): ShellSection[] => {
    const d = n(p, 'bore'),
      s = n(p, 'acrossFlats'),
      h = n(p, 'height');
    const sides = style === 'square' ? 4 : 6;
    const r = s / (2 * Math.cos(Math.PI / sides));
    const bottom = style === 'flange' ? n(p, 'flangeThickness') : 0;
    const top = style === 'nyloc' || style === 'cap' ? n(p, 'bodyHeight') : h;
    const c = Math.min((s - d) / 8, (top - bottom) / 5);
    const chamfer = Math.min(c / 2, (top - bottom) / 3);
    // Sample the same conical edge chamfers used by the analytic CAD solid.
    const flats = outline(r, sides);
    const edge = (fraction: number, z: number): ShellSection => ({
      z,
      outer: flats.map((v) =>
        v.clone().setLength(Math.min(v.length(), s / 2 + (r - s / 2) * fraction)),
      ),
      bore: d + c * (1 - fraction),
    });
    return [
      ...Array.from({ length: 5 }, (_, i) => edge(i / 4, bottom + (chamfer * i) / 4)),
      ...Array.from({ length: 5 }, (_, i) => edge(1 - i / 4, top - chamfer + (chamfer * i) / 4)),
    ];
  };
  const cap = (p: Parameters): TurnedProfile => {
    const d = n(p, 'bore'),
      s = n(p, 'acrossFlats'),
      h = n(p, 'height'),
      b = n(p, 'bodyHeight');
    const r = s * 0.47,
      rise = Math.min(r, (h - b) * 0.8),
      shoulder = h - rise;
    const dome: TurnedProfile = Array.from({ length: 25 }, (_, i) => [
      r * Math.cos((i * Math.PI) / 48),
      shoulder + rise * Math.sin((i * Math.PI) / 48),
    ]);
    return [[d / 2, b], [r, b], ...dome, [0, shoulder], [d / 2, shoulder], [d / 2, b]];
  };
  const build = (p: Parameters) => {
    const g = new Group();
    g.add(threadedShellMesh(sections(p), p, n(p, 'bore')));
    if (style === 'flange') {
      const a = threadedShellMesh(
        [
          {
            z: 0,
            outer: outline(n(p, 'flangeDiameter') / 2),
            bore: nominalThreadDiameter(p, n(p, 'bore')),
          },
          {
            z: n(p, 'flangeThickness'),
            outer: outline(n(p, 'flangeDiameter') / 2),
            bore: nominalThreadDiameter(p, n(p, 'bore')),
          },
        ],
        p,
        n(p, 'bore'),
      );
      g.add(a);
    }
    if (style === 'nyloc') {
      const b = n(p, 'bodyHeight'),
        h = n(p, 'height'),
        s = n(p, 'acrossFlats'),
        d = n(p, 'bore');
      const collar = ring(s * 0.47, (d + s) / 4, h - b);
      collar.position.z = (h + b) / 2;
      const insert = ring((d + s) / 4, d / 2, (h - b) * 0.85, 0x264d71);
      insert.position.z = b + (h - b) * 0.425;
      g.add(collar, insert);
    }
    if (style === 'cap') {
      const mesh = turnedMesh(cap(p));
      removeDegenerateTriangles(mesh.geometry);
      g.add(mesh);
    }
    return g;
  };
  return {
    id,
    name,
    standard,
    category: 'FASTENERS & THREADS',
    subgroup: 'NUTS',
    icon: 'bolt',
    complexity: 'Standard nut profiles',
    description: `${name} with chamfered wrench flats and a labeled nominal-diameter thread bore.`,
    keywords: [name, standard, 'nut', 'thread', 'fastener'],
    defaults,
    presets: [],
    parameters: [
      numberParameter('bore', 'Metric thread diameter', 'd', 'Thread', 1, 160),
      ...internalThreadParameters,
      numberParameter('acrossFlats', 'Across flats', 's', 'Dimensions', 2, 240),
      numberParameter('height', 'Overall height', 'h', 'Dimensions', 0.5, 400),
      ...(style === 'flange'
        ? [
            numberParameter('flangeDiameter', 'Flange diameter', 'dc', 'Flange', 3, 300),
            numberParameter('flangeThickness', 'Flange thickness', 'c', 'Flange', 0.2, 30),
          ]
        : []),
      ...(style === 'nyloc' || style === 'cap'
        ? [numberParameter('bodyHeight', 'Hex body height', 'm', 'Body', 0.3, 200)]
        : []),
    ],
    presetMatchKeys: ['bore', 'acrossFlats', 'height'],
    updateParameters(p, changedKey) {
      return changedKey === 'bore' ? { ...p, pitch: nutCoarsePitch(n(p, 'bore')) } : p;
    },
    validate(p) {
      const d = n(p, 'bore'),
        s = n(p, 'acrossFlats'),
        h = n(p, 'height');
      const errors: string[] = internalThreadErrors(p, d, h);
      if (style === 'nyloc' && d >= s * 0.88)
        errors.push('The nylon collar needs more material around the bore.');
      if (s <= d + 0.2) errors.push('Across flats must leave material around the bore.');
      if ((style === 'cap' || style === 'nyloc') && n(p, 'bodyHeight') >= h)
        errors.push('The collar or cap must rise above the hex body.');
      if (style === 'cap' && h - n(p, 'bodyHeight') <= (s - d) / 4)
        errors.push('Cap height must leave an internal cavity.');
      if (style === 'flange' && (n(p, 'flangeDiameter') <= s || n(p, 'flangeThickness') >= h))
        errors.push('The flange must extend beyond the flats and fit below the body.');
      return errors;
    },
    buildGeometry: build,
    python(p) {
      const d = n(p, 'bore'),
        minor = nominalThreadDiameter(p, d);
      const profile = sections(p).filter((_, i) => [0, 4, 5, 9].includes(i)),
        bottom = profile[0],
        top = profile.at(-1)!;
      const sides = style === 'square' ? 4 : 6;
      const radius = n(p, 'acrossFlats') / (2 * Math.cos(Math.PI / sides));
      const vertices = Array.from({ length: sides }, (_, i) => {
        const angle = ((i + 0.5) * 2 * Math.PI) / sides;
        return new Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
      });
      const outer: TurnedProfile = [
        [0, bottom.z],
        ...profile.map((s): [number, number] => [Math.max(...s.outer.map((v) => v.length())), s.z]),
        [0, top.z],
        [0, bottom.z],
      ];
      const bore: TurnedProfile = [
        [0, bottom.z],
        ...profile.map((s): [number, number] => [s.bore / 2, s.z]),
        [0, top.z],
        [0, bottom.z],
      ];
      const metalBodies = [
        `${polygonPython(vertices, top.z - bottom.z, bottom.z)}.common(${turnedPython(outer)}).cut(${turnedPython(bore)}).removeSplitter()`,
      ];
      const annulus = (ro: number, ri: number, height: number, z: number) =>
        `Part.makeCylinder(${num(ro)},${num(height)},App.Vector(0,0,${num(z)})).cut(Part.makeCylinder(${num(ri)},${num(height)},App.Vector(0,0,${num(z)})))`;
      if (style === 'flange')
        metalBodies.push(
          annulus(n(p, 'flangeDiameter') / 2, minor / 2, n(p, 'flangeThickness'), 0),
        );
      if (style === 'nyloc') {
        const b = n(p, 'bodyHeight'),
          h = n(p, 'height'),
          s = n(p, 'acrossFlats');
        metalBodies.push(annulus(s * 0.47, (d + s) / 4, h - b, b));
      }
      if (style === 'cap') metalBodies.push(turnedPython(cap(p)));
      const lines = [`shape = ${metalBodies[0]}`];
      for (const body of metalBodies.slice(1)) lines.push(`shape = shape.fuse(${body})`);
      const threadHeight =
        style === 'nyloc' || style === 'cap' ? n(p, 'bodyHeight') : n(p, 'height');
      lines.push(internalThreadPython(p, d, threadHeight));
      lines.push(
        'if len(shape.Solids) != 1: raise ValueError("The threaded nut body must form one solid.")',
      );
      if (style === 'nyloc') {
        const b = n(p, 'bodyHeight'),
          h = n(p, 'height'),
          s = n(p, 'acrossFlats');
        lines.push(
          `nylon_insert = ${annulus((d + s) / 4, d / 2, (h - b) * 0.85, b)}`,
          'shape = Part.makeCompound([shape, nylon_insert])',
          "component_labels = ['Nut body', 'Nylon insert']",
          'component_metadata.append({})',
          'component_colors = [(0.62,0.70,0.78),(0.15,0.30,0.44)]',
        );
      }
      return lines.filter(Boolean).join('\n');
    },
    dimensions(p) {
      return modelBounds(build(p));
    },
    notes:
      'Supplier presets preserve the listed envelope dimensions. Edge chamfers and unspecified collar details are editable prototype geometry. Metal threads use smooth nominal-diameter bores with diameter, pitch, direction and span callouts. Nominal bore geometry is not a tap-drill specification. Specify fit class and machining depths on the drawing. Nylon inserts retain their undeformed smooth bore.',
  };
}
