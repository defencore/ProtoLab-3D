import { detailComponent } from '../../../core/component-recipes';
import type { AssemblyDefinition } from '../../../core/product-types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { assemblyBounds, sectorPoints, type Component, type Solid } from './solids';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';

function detailShape(solid: Solid): Shape {
  if (solid.kind === 'union' || solid.kind === 'cut' || solid.kind === 'intersection')
    return {
      kind:
        solid.kind === 'cut' ? 'subtract' : solid.kind === 'intersection' ? 'intersect' : 'union',
      children: solid.items.map(detailShape),
    };
  if (solid.kind === 'torus')
    return {
      kind: 'torus',
      major: solid.major,
      minor: solid.minor,
      origin: [...solid.center],
      innerSegments: 16,
      outerSegments: 64,
    };
  if (solid.kind === 'cylinder') {
    const origin = [...solid.center] as Vec;
    origin[solid.axis === 'x' ? 0 : 2] -= solid.length / 2;
    return {
      kind: 'cylinder',
      radius: solid.radius,
      height: solid.length,
      axis: solid.axis,
      origin,
      segments: 64,
    };
  }
  return {
    kind: 'transform',
    child: {
      kind: 'prism',
      points: sectorPoints(solid),
      depth: solid.height,
      origin: -solid.height / 2,
      axis: 'z',
    },
    translation: [...solid.center],
    rotation: solid.axis === 'x' ? [0, 90, 0] : [0, 0, 0],
  };
}

export function pistonPieces(pieces: readonly Component[]): ConfiguredPiece[] {
  const bounds = assemblyBounds([...pieces]);
  const center = bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
  return pieces.map((piece, i) => ({
    component: detailComponent(`piston-component-${i + 1}`, piece.name, detailShape(piece.solid), {
      edgeTolerance: 1e-6,
      meshConform: true,
    }),
    label: piece.name,
    color: piece.color,
    requireSingleSolid: true,
    position: piece.offset.map((value, axis) => value - center[axis]) as Vec,
  }));
}

export function pistonComposition(pieces: readonly Component[]): AssemblyDefinition {
  const bounds = assemblyBounds([...pieces]);
  const center = bounds[0].map((value, axis) => (value + bounds[1][axis]) / 2);
  return {
    components: pieces.map((piece, i) => {
      const component = detailComponent(
        `piston-component-${i + 1}`,
        piece.name,
        detailShape(piece.solid),
        { edgeTolerance: 1e-6, meshConform: true },
      );
      component.placement.translation = component.placement.translation.map(
        (value, axis) => value + piece.offset[axis] - center[axis],
      ) as Vec;
      return component;
    }),
    issues: [
      'Specify the piston alloy, blank, machining sequence, running and thermal clearances, bore finish, groove tolerances and any balancing requirements.',
      'Rings, seals, pin and clips are prototype geometries. Select real supplier products or issue complete material, forming or machining and retention definitions; nominal listing size is not a running fit.',
      'Confirm actual cylinder, rod, sealing and lubrication interfaces and the intended service loads before release.',
    ],
  };
}
