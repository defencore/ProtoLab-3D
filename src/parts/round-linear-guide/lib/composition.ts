import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { box, prism, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import { roundCircuit } from './parts/guide-circuits';
import { insertSection } from './parts/round-guide-insert';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { STEEL, DARK_STEEL } from '../../../core/geometry';

// The source shaft and housing circles use 72 samples; the extruded
// wiper arcs use 128. Resolution is part of the explicit preview policy.
function cylinder(
  radius: number,
  height: number,
  origin: [number, number, number],
  axis: 'x' | 'y' | 'z' = 'z',
  segments = 72,
): Shape {
  return { kind: 'cylinder', radius, height, origin, axis, segments };
}

export function roundGuideComposition(p: Parameters, cutaway = false): AssemblyDefinition {
  const sleeve = roundCircuit(p),
    length = n(p, 'length'),
    blockLength = n(p, 'blockLength'),
    width = n(p, 'blockWidth'),
    height = n(p, 'blockHeight');
  let housing = subtract(
    box([blockLength, width, height], [sleeve.x - blockLength / 2, -width / 2, 0]),
    cylinder(
      sleeve.outer + 0.05,
      blockLength + 2,
      [sleeve.x - blockLength / 2 - 1, 0, sleeve.z],
      'x',
    ),
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) =>
        cylinder(n(p, 'holeDiameter') / 2, height + 2, [
          sleeve.x + (sx * n(p, 'pitchX')) / 2,
          (sy * n(p, 'pitchY')) / 2,
          -1,
        ]),
      ),
    ),
  );
  if (cutaway)
    housing = subtract(
      housing,
      box([blockLength + 2, width, height + 2], [sleeve.x - blockLength / 2 - 1, 0, -1]),
    );
  const section = insertSection(p, cutaway),
    cageLength = blockLength - 2 * sleeve.radius;
  const cage: Shape = {
    kind: 'transform',
    child: cutaway
      ? prism(
          [...section.outerPoints, ...section.inner].map(({ x, y }) => [x, y]),
          cageLength,
          -cageLength / 2,
        )
      : subtract(
          prism(
            section.outerPoints.map(({ x, y }) => [x, y]),
            cageLength,
            -cageLength / 2,
          ),
          prism(
            section.inner.map(({ x, y }) => [x, y]),
            cageLength + 2,
            -cageLength / 2 - 1,
          ),
        ),
    translation: [sleeve.x, 0, sleeve.z],
    rotation: [90, 0, 90],
  };
  const wiper = (side: number) =>
    subtract(
      cylinder(
        sleeve.outer,
        sleeve.radius,
        [sleeve.x + side * (blockLength / 2 - sleeve.radius / 2) - sleeve.radius / 2, 0, sleeve.z],
        'x',
        128,
      ),
      cylinder(
        sleeve.shaft + n(p, 'clearance'),
        sleeve.radius + 2,
        [
          sleeve.x + side * (blockLength / 2 - sleeve.radius / 2) - sleeve.radius / 2 - 1,
          0,
          sleeve.z,
        ],
        'x',
        128,
      ),
    );
  return {
    components: [
      detailComponent(
        'guide-shaft',
        'Guide shaft',
        cylinder(sleeve.shaft, length, [-length / 2, 0, sleeve.z], 'x'),
      ),
      detailComponent('carriage-housing', 'Carriage housing', housing, { meshConform: true }),
      detailComponent('return-cage', 'Ball-bushing return cage', cage),
      detailComponent('rear-wiper', 'Rear wiper', wiper(-1)),
      detailComponent('front-wiper', 'Front wiper', wiper(1)),
      ...sleeve.points.map((point, i) =>
        detailComponent(`recirculating-ball-${i + 1}`, `Recirculating ball ${i + 1}`, {
          kind: 'sphere',
          radius: sleeve.radius,
          origin: point.toArray() as [number, number, number],
          segments: 32,
        }),
      ),
    ].map((component) => {
      component.parameters.meshEdgeTolerance = 1e-6;
      return component;
    }),
    issues: [
      'This is an authored round-guide prototype rather than a supplier bushing execution. Select a complete commercial guide or complete the return-channel, cage, preload, retention and sealing design.',
      'Identify a hardened precision shaft, rolling balls and compatible wipers with their actual grades and fits. The shown nominal sizes and ball count do not establish bearing performance or a grinding specification.',
      'Specify housing material, stock, mounting tolerances, lubrication and load/travel acceptance requirements before release.',
    ],
  };
}

export function roundGuidePieces(p: Parameters, state: string): ConfiguredPiece[] {
  const components = roundGuideComposition(p, state === 'cutaway').components;
  return components
    .filter((component) =>
      state === 'shaft'
        ? component.id === 'guide-shaft'
        : state === 'block'
          ? component.id !== 'guide-shaft'
          : true,
    )
    .map((component) => ({
      component,
      requireSingleSolid: true,
      label: component.name === 'Ball-bushing return cage' ? 'Return cage' : component.name,
      color:
        component.id === 'guide-shaft'
          ? STEEL
          : component.id === 'carriage-housing'
            ? DARK_STEEL
            : component.id === 'return-cage'
              ? 0x7c858d
              : component.id.endsWith('wiper')
                ? 0x242b32
                : 0xb7c0cb,
    }));
}
