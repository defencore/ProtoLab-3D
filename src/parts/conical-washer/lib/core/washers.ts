import { Group, Shape, Path, Vector2 } from 'three';
import { extrude, n, num, numberParameter } from '../../../../core/geometry';
import { polygonPython, modelBounds } from './hardware';
import { turnedMesh, turnedPython, type TurnedProfile } from '../parts/motion-bearing-utils';
import type { Parameters, PartDefinition } from '../../../../core/types';

export function washerDefinition(
  id: string,
  name: string,
  style: 'square' | 'conical' | 'toothed',
  defaults: Parameters,
): PartDefinition {
  const points = (p: Parameters) =>
    style === 'square'
      ? [
          new Vector2(-n(p, 'outerDiameter') / 2, -n(p, 'outerDiameter') / 2),
          new Vector2(n(p, 'outerDiameter') / 2, -n(p, 'outerDiameter') / 2),
          new Vector2(n(p, 'outerDiameter') / 2, n(p, 'outerDiameter') / 2),
          new Vector2(-n(p, 'outerDiameter') / 2, n(p, 'outerDiameter') / 2),
        ]
      : Array.from({ length: n(p, 'teeth') * 4 }, (_, i) => {
          const angle = (i * Math.PI) / (n(p, 'teeth') * 2),
            r = n(p, 'outerDiameter') / 2 - (i % 4 < 2 ? 0 : n(p, 'toothDepth'));
          return new Vector2(r * Math.cos(angle), r * Math.sin(angle));
        });
  const profile = (p: Parameters): TurnedProfile => {
    const d = n(p, 'bore') / 2,
      r = n(p, 'outerDiameter') / 2,
      t = n(p, 'thickness'),
      h = n(p, 'rise');
    return [
      [r, 0],
      [r, t],
      [d, t + h],
      [d, h],
      [r, 0],
    ];
  };
  const build = (p: Parameters) => {
    const g = new Group();
    if (style === 'conical') g.add(turnedMesh(profile(p)));
    else {
      const s = new Shape(points(p));
      const hole = new Path();
      hole.absarc(0, 0, n(p, 'bore') / 2, 0, Math.PI * 2, true);
      s.holes.push(hole);
      g.add(extrude(s, n(p, 'thickness')));
    }
    return g;
  };
  return {
    id,
    name,
    category: 'FASTENERS',
    subgroup: 'WASHERS',
    icon: 'bolt',
    complexity: 'Washer profile',
    description: `${name} with editable fit and section dimensions.`,
    keywords: [name, 'washer', 'lock', 'retainer'],
    defaults,
    presets: [],
    parameters: [
      numberParameter('bore', 'Bore diameter', 'd', 'Dimensions', 0.5, 200),
      numberParameter(
        'outerDiameter',
        style === 'square' ? 'Side length' : 'Outside diameter',
        'D',
        'Dimensions',
        2,
        400,
      ),
      numberParameter('thickness', 'Material thickness', 's', 'Dimensions', 0.1, 30),
      ...(style === 'conical'
        ? [numberParameter('rise', 'Cone rise', 'h', 'Profile', 0.1, 30)]
        : []),
      ...(style === 'toothed'
        ? [
            { ...numberParameter('teeth', 'Tooth count', 'z', 'Teeth', 6, 40, 1), unit: undefined },
            numberParameter('toothDepth', 'Tooth depth', 'a', 'Teeth', 0.1, 15),
          ]
        : []),
    ],
    presetMatchKeys: ['bore', 'outerDiameter', 'thickness'],
    validate(p) {
      const errors = [];
      if (n(p, 'outerDiameter') <= n(p, 'bore')) errors.push('The outside must exceed the bore.');
      if (style === 'toothed' && n(p, 'outerDiameter') - 2 * n(p, 'toothDepth') <= n(p, 'bore'))
        errors.push('Teeth must leave material around the bore.');
      return errors;
    },
    buildGeometry: build,
    python(p) {
      return style === 'conical'
        ? `shape = ${turnedPython(profile(p))}`
        : `shape = ${polygonPython(points(p), n(p, 'thickness'), -n(p, 'thickness') / 2)}.cut(Part.makeCylinder(${num(n(p, 'bore') / 2)},${num(n(p, 'thickness') + 2)},App.Vector(0,0,${num(-n(p, 'thickness') / 2 - 1)})))`;
    },
    dimensions(p) {
      return modelBounds(build(p));
    },
    notes:
      style === 'toothed'
        ? 'Tooth count and depth are prototype choices unless explicitly listed as verified dimensions. Teeth are planar; stamped tooth twist is not modeled.'
        : 'A geometric envelope for prototype layout. Spring force, tolerances and surface finish are not modeled.',
  };
}
