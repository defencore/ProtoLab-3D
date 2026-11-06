import { Box3, Euler, Quaternion, Vector3 } from 'three';
import type { PartDefinition } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentGeometry } from '../../../core/assembly/detail-instances';
import { disposeModel } from '../../../core/mechanical';
import { printingRotations } from './printing-poses';

type Vec = [number, number, number];
interface Placement {
  id: string;
  offset: Vec;
}
let cached: { key: string; placements: Placement[]; dimensions: Vec } | undefined;
const gap = 8;
/** Keep each fabrication recipe intact; only its printing pose changes. */
function orient(piece: ConfiguredPiece): ConfiguredPiece {
  const anglesDegrees: Vec | undefined =
    piece.component.parameters.printPose === 'x-plus-down'
      ? [0, 90, 0]
      : piece.component.parameters.printPose === 'x-minus-down'
        ? [0, -90, 0]
        : piece.component.parameters.printPose === 'front-down'
          ? [180, 0, 0]
          : piece.component.parameters.printPose === 'rear-down'
            ? [0, 0, 0]
            : (printingRotations[piece.component.id] ??
              (piece.component.id.startsWith('window-') ? [0, 0, 0] : undefined));
  if (!anglesDegrees) return piece;
  const source = piece.component.placement;
  const turn = new Quaternion().setFromEuler(
    new Euler(...(anglesDegrees.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'),
  );
  const rotation = new Quaternion().setFromEuler(
    new Euler(...(source.rotation.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'),
  );
  const angles = new Euler().setFromQuaternion(turn.clone().multiply(rotation), 'ZYX');
  return {
    ...piece,
    component: {
      ...piece.component,
      placement: {
        translation: new Vector3(...source.translation).applyQuaternion(turn).toArray() as Vec,
        rotation: [angles.x, angles.y, angles.z].map((v) =>
          Math.abs(v) < 1e-10 ? 0 : (v * 180) / Math.PI,
        ) as Vec,
      },
    },
  };
}

/** A spaced parts layout, independent of a slicer's bed size or material settings. */
export function printingLayout(
  libraries: readonly PartDefinition[],
  source: readonly ConfiguredPiece[],
  key: string,
): { pieces: ConfiguredPiece[]; dimensions: Vec } {
  const pieces = source
    .filter(
      (piece) =>
        piece.component.supply === 'manufactured' &&
        piece.component.manufacturing?.processes.includes('printing'),
    )
    .map(orient);
  if (!cached || cached.key !== key) {
    const bounds = pieces.map((piece) => {
      // Geometry resources are initialized by the part lifecycle before measuring.
      // Reuse the actual fabrication backend rather than rebuilding complex CSG.
      const model = componentGeometry(libraries, [piece]);
      try {
        model.updateMatrixWorld(true);
        return new Box3().setFromObject(model, true);
      } finally {
        disposeModel(model);
      }
    });
    const sizes = bounds.map((box) => box.getSize(new Vector3()));
    const rowWidth = Math.max(
      ...sizes.map((size) => size.x),
      Math.sqrt(sizes.reduce((area, size) => area + (size.x + gap) * (size.y + gap), 0)) * 1.1,
    );
    let x = 0,
      y = 0,
      rowDepth = 0,
      width = 0,
      height = 0;
    const placements = pieces.map((piece, index) => {
      const size = sizes[index],
        min = bounds[index].min;
      if (x > 0 && x + size.x > rowWidth) {
        y += rowDepth + gap;
        x = 0;
        rowDepth = 0;
      }
      const offset: Vec = [x - min.x, y - min.y, -min.z];
      width = Math.max(width, x + size.x);
      height = Math.max(height, size.z);
      rowDepth = Math.max(rowDepth, size.y);
      x += size.x + gap;
      return { id: piece.component.id, offset };
    });
    const depth = y + rowDepth;
    for (const placement of placements) {
      placement.offset[0] -= width / 2;
      placement.offset[1] -= depth / 2;
    }
    cached = { key, placements, dimensions: [width, depth, height] };
  }
  const placements = new Map(
    cached.placements.map((placement) => [placement.id, placement.offset]),
  );
  return {
    pieces: pieces.map((piece) => ({
      ...piece,
      position: [...placements.get(piece.component.id)!] as Vec,
    })),
    dimensions: [...cached.dimensions],
  };
}
