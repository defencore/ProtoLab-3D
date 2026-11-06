import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { annularSectorPoints, type AnnularSectorShape } from '../../../core/analytic-geometry';
import { subtract, union, type Shape, type Vec } from '../../../core/assembly/boundary/shapes';

export function layout(p: Parameters) {
  const R = Number(p.diameter) / 2,
    H = Number(p.height),
    w = Number(p.wall),
    floor = Number(p.floor),
    roof = Number(p.lidThickness),
    neckH = Number(p.neckHeight),
    count = Number(p.lugs),
    projection = Number(p.lugProjection),
    lugT = Number(p.lugThickness),
    span = Number(p.lugSpan),
    turn = Number(p.turnAngle),
    c = Number(p.clearance),
    ac = Number(p.axialClearance),
    tc = Number(p.tangentialClearance),
    faceGap = Number(p.faceGap),
    roofGap = Number(p.roofGap),
    neckR = R - w,
    neckZ = H - neckH,
    boreR = neckR - w,
    capZ = neckZ + faceGap,
    lugZ = neckZ + w,
    lugRelativeZ = lugZ - capZ,
    angleGap = ((tc / neckR) * 180) / Math.PI,
    grooveR = neckR + projection + c,
    capR = grooveR + w,
    capSkirt = H + roofGap - capZ,
    capHeight = capSkirt + roof;
  return {
    R,
    H,
    w,
    floor,
    roof,
    neckH,
    count,
    projection,
    lugT,
    span,
    turn,
    c,
    ac,
    tc,
    faceGap,
    roofGap,
    neckR,
    neckZ,
    boreR,
    capZ,
    lugZ,
    lugRelativeZ,
    angleGap,
    grooveR,
    capR,
    capSkirt,
    capHeight,
  };
}

/** Same sampled arc in the preview and true circular arcs in the native profile. */
function sector(
  inner: number,
  outer: number,
  start: number,
  end: number,
  z: number,
  depth: number,
): Shape {
  const native: AnnularSectorShape = { kind: 'annular-sector', inner, outer, start, end, z, depth };
  return {
    kind: 'prism',
    points: annularSectorPoints(native),
    depth,
    origin: z,
    axis: 'z',
    native,
  };
}

export function shapes(p: Parameters): [Shape, Shape] {
  const d = layout(p),
    angles = Array.from({ length: d.count }, (_, i) => (i * 360) / d.count);
  // Resolve rotated outer circles accurately in preview; native surfaces remain cylinders.
  const C = (radius: number, height: number, origin: Vec): Shape => ({
    kind: 'cylinder',
    radius,
    height,
    origin,
    axis: 'z',
    segments: 128,
  });
  const body = subtract(
    union(
      C(d.R, d.neckZ + 0.2, [0, 0, 0]),
      C(d.neckR, d.neckH, [0, 0, d.neckZ]),
      ...angles.map((a) =>
        sector(
          d.neckR - 0.2,
          d.neckR + d.projection,
          a - d.span / 2,
          a + d.span / 2,
          d.lugZ,
          d.lugT,
        ),
      ),
    ),
    C(d.boreR, d.H + 1, [0, 0, d.floor]),
  );
  const cap = subtract(
    C(d.capR, d.capHeight, [0, 0, 0]),
    C(d.neckR + d.c, d.capSkirt + 1, [0, 0, -1]),
    ...angles.flatMap((a) => [
      sector(
        d.neckR - 0.2,
        d.grooveR,
        a - d.span / 2 - d.angleGap,
        a + d.span / 2 + d.angleGap,
        -1,
        d.lugRelativeZ + d.lugT + d.ac + 1,
      ),
      sector(
        d.neckR - 0.2,
        d.grooveR,
        a - d.turn - d.span / 2 - d.angleGap,
        a + d.span / 2 + d.angleGap,
        d.lugRelativeZ - d.ac,
        d.lugT + 2 * d.ac,
      ),
    ]),
  );
  return [body, cap];
}

export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  return shapes(p).map((shape, i) => {
    const component = detailComponent(
      i ? 'lid' : 'body',
      i
        ? 'Printed bayonet cap with internal L channels'
        : 'Printed can body with integral bayonet lugs',
      shape,
      { preserveAuthoredFrame: true },
    );
    component.placement = { translation: [0, 0, i ? d.capZ : 0], rotation: [0, 0, i ? d.turn : 0] };
    component.manufacturing = {
      material: 'Project-selected printing polymer; qualify grade and print settings',
      blank: 'Individually printed hollow enclosure part',
      processes: ['printing'],
      requirements: [
        i
          ? 'Print outer lid roof down; review internal groove bridging/support and removal access.'
          : 'Print body floor down; review lug underside overhang and layer strength.',
        'Measure radial, axial and tangential clearances; qualify retention load, unlocking torque, creep and cycle life. No seal or ingress rating is assigned.',
      ],
    };
    return component;
  });
}

export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p);
  return components(p).map((source, i) => {
    const component = {
      ...source,
      placement: {
        translation: [...source.placement.translation] as Vec,
        rotation: [...source.placement.rotation] as Vec,
      },
    };
    if (i && state === 'unlocked') component.placement.rotation = [0, 0, 0];
    if (i && state === 'exploded')
      component.placement = { translation: [0, 0, d.H + d.neckH + 8], rotation: [0, 0, 0] };
    if (i && state === 'print')
      component.placement = {
        translation: [d.R + d.capR + 8, 0, d.capHeight],
        rotation: [180, 0, 0],
      };
    return {
      component,
      label: component.name,
      color: i ? 0x4c8b9d : 0xe7aa4b,
      requireSingleSolid: true,
    };
  });
}
