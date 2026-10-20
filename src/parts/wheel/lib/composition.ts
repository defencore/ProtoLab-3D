import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Parameters } from '../../../core/types';
import { n } from '../../../core/geometry';
import { subtract, type Shape } from '../../../core/assembly/boundary/shapes';

export function wheelPieces(p: Parameters) {
  const r = n(p, 'diameter') / 2,
    bore = n(p, 'bore') / 2,
    hub = n(p, 'hubDiameter') / 2,
    width = n(p, 'width'),
    hubLength = n(p, 'hubLength');
  const annulus = (outer: number, inner: number, length: number): Shape =>
    subtract(
      {
        kind: 'cylinder',
        radius: outer,
        height: length,
        origin: [0, 0, -length / 2],
        axis: 'z',
        segments: 96,
      },
      {
        kind: 'cylinder',
        radius: inner,
        height: length + 2,
        origin: [0, 0, -length / 2 - 1],
        axis: 'z',
        segments: 96,
      },
    );
  const rimRadius = r * 0.78,
    rimHalf = (width * 0.6) / 2,
    hubHalf = hubLength / 2;
  const rimProfile: [number, number][] =
    hubHalf === rimHalf
      ? [
          [bore, -rimHalf],
          [rimRadius, -rimHalf],
          [rimRadius, rimHalf],
          [bore, rimHalf],
        ]
      : [
          [bore, -hubHalf],
          [hub, -hubHalf],
          [hub, -rimHalf],
          [rimRadius, -rimHalf],
          [rimRadius, rimHalf],
          [hub, rimHalf],
          [hub, hubHalf],
          [bore, hubHalf],
        ];
  return [
    { label: 'Tire', color: 0x343d48, shape: annulus(r, r * 0.78, width) },
    {
      label: 'Rim and hub',
      color: 0xb3bcc8,
      shape: { kind: 'revolve', profile: rimProfile, segments: 96 } as Shape,
    },
  ];
}

export function wheelComposition(p: Parameters): AssemblyDefinition {
  return {
    components: wheelPieces(p).map((piece, i) =>
      detailComponent(i === 0 ? 'tire' : 'rim-hub', piece.label, piece.shape),
    ),
    issues: [
      'Select the tire elastomer, forming process and rim material, blank and manufacturing route. Define the tire-to-rim retention fit.',
      'Specify the actual axle fit, bearings or bushings, retention hardware and inspection requirements before service use; these interfaces are not included in the generic wheel.',
    ],
  };
}
