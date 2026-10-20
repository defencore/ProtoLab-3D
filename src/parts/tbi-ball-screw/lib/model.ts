import { Group } from 'three';
import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract, union, type Shape } from '../../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../../core/assembly/boundary/assembly';
import screw from '../../ball-screw/part';
import models from './models.json';
export { models };
export function screwModel(p: Parameters) {
  const m = models.find((m) => m.id === p.model);
  if (!m) throw new Error('Select a supported TBI model.');
  return m;
}
export function nutCenter(p: Parameters) {
  const m = screwModel(p);
  return (
    (Number(p.nutPosition) / 100 - 0.5) * (Number(p.length) - m.nutLength - 2 * m.lead) +
    (m.lead * Number(p.rotation)) / 360
  );
}
export function screwParameters(p: Parameters): Parameters {
  const m = screwModel(p);
  return {
    ...screw.defaults,
    family: 'SFU',
    shaftDiameter: m.diameter,
    lead: m.lead,
    ballDiameter: m.ballDiameter,
    length: Number(p.length),
    endMachining: 'none',
    nutPosition: Number(p.nutPosition),
    rotation: Number(p.rotation),
    nutLength: m.nutLength,
    nutDiameter: m.nutDiameter,
    flangeDiameter: m.flangeDiameter,
    flangeWidth: m.flangeWidth,
    flangeThickness: m.flangeThickness,
    flangeOffset: 0,
    mountCircle: m.mountCircle,
    mountHoleDiameter: m.mountHole,
    mountHoleCount: m.code.startsWith('SFB012') ? '4' : '6',
    circuits: m.circuits,
    circuitTurns: m.turns,
    oilHoleDiameter: 0,
  };
}
export function mountAngles(p: Parameters) {
  return screwModel(p).code.startsWith('SFB012')
    ? [45, 135, 225, 315]
    : [45, 90, 135, 225, 270, 315];
}
export function nutMountingHoles(p: Parameters): [number, number][] {
  const m = screwModel(p);
  return mountAngles(p).map((a) => [
    (m.mountCircle / 2) * Math.cos((a * Math.PI) / 180),
    (m.mountCircle / 2) * Math.sin((a * Math.PI) / 180),
  ]);
}
export function nutPieces(p: Parameters, state: string): Piece[] {
  const m = screwModel(p),
    start = -m.nutLength / 2,
    z = state === 'nut' ? 0 : nutCenter(p);
  const flange: Shape = {
    kind: 'intersect',
    children: [
      cylinder(m.flangeDiameter / 2, m.flangeThickness, [0, 0, start]),
      box(
        [m.flangeWidth, m.flangeDiameter + 2, m.flangeThickness + 2],
        [-m.flangeWidth / 2, -m.flangeDiameter / 2 - 1, start - 1],
      ),
    ],
  };
  const tools: Shape[] = [
    cylinder(m.diameter / 2 + 0.15, m.nutLength + 2, [0, 0, start - 1]),
    ...nutMountingHoles(p).map(([x, y]) =>
      cylinder(m.mountHole / 2, m.flangeThickness + 2, [x, y, start - 1]),
    ),
  ];
  // Q specifies nominal lubrication thread only; its undimensioned location/depth remain illustrative.
  if (m.oilThread) {
    const wall = (m.nutDiameter - m.diameter) / 2;
    tools.push(
      cylinder(
        m.oilThread / 2,
        Math.min(wall * 0.7, 4) + 1,
        [0, m.nutDiameter / 2 - Math.min(wall * 0.7, 4), 0],
        'y',
      ),
    );
  }
  return [
    {
      label: `TBI ${m.code} nut / flange and mounting holes`,
      color: 0xa1a7ad,
      z,
      shape: subtract(
        union(cylinder(m.nutDiameter / 2, m.nutLength, [0, 0, start]), flange),
        ...tools,
      ),
    },
  ];
}
export function build(p: Parameters, state: string): Group {
  const result = new Group();
  if (state !== 'nut') {
    const shaft = screw.buildGeometry(screwParameters(p), 'screw');
    result.add(...[...shaft.children]);
  }
  if (state !== 'screw') {
    const nut = geometry(nutPieces(p, state));
    result.add(...[...nut.children]);
  }
  return result;
}
export function recipe(p: Parameters, state: string): string {
  if (state === 'screw') return screw.python(screwParameters(p), 'screw');
  const nut = python(nutPieces(p, state));
  if (state === 'nut') return nut;
  return `${screw.python(screwParameters(p), 'screw')}\n_tbi_screw_components=list(components)\n_tbi_screw_labels=list(component_labels)\n_tbi_screw_colors=list(component_colors)\n${nut}\ncomponents=_tbi_screw_components+components\ncomponent_labels=_tbi_screw_labels+component_labels\ncomponent_colors=_tbi_screw_colors+component_colors\ncomponent_metadata=[{} for _ in components]\nshape=Part.makeCompound(components)`;
}
export function validate(p: Parameters): string[] {
  if (!models.some((m) => m.id === p.model)) return ['Select a supported TBI screw and nut model.'];
  const m = screwModel(p),
    length = Number(p.length),
    center = nutCenter(p),
    errors: string[] = [];
  if (length < m.nutLength + 2 * m.lead)
    errors.push('Shaft length must contain the nut and at least two leads of travel allowance.');
  if (Math.abs(center) + m.nutLength / 2 > length / 2)
    errors.push('The chosen nut position and rotation move the nut beyond the shaft.');
  return errors;
}
