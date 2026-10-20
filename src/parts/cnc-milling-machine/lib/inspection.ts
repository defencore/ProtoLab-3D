import { Box3, Euler, Matrix4, Vector3 } from 'three';
import type { PartDefinition } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { MillingPiece, Motion } from './composition';
import { withGeometryMode } from '../../../core/geometry-mode';
import { disposeModel } from '../../../core/mechanical';
import frame, { frameBounds } from '../../cnc-frame-part/part';

export interface InspectionBounds {
  min: Vec;
  max: Vec;
}
export type InspectionGroupBounds = Partial<Record<Motion, InspectionBounds>>;
const groups: readonly Motion[] = ['fixed', 'gantry', 'x', 'z'];
const localBounds = new WeakMap<PartDefinition, Map<string, InspectionBounds>>();
const euler = (angles: Vec) =>
  new Euler(...(angles.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX');

/** Actual local meshes supply their origins as well as their size; a size cannot imply a centered datum. */
function configuredBounds(part: PartDefinition, piece: MillingPiece): InspectionBounds {
  let cache = localBounds.get(part);
  if (!cache) localBounds.set(part, (cache = new Map()));
  const { parameters, state } = piece.component;
  const key = JSON.stringify([parameters, state]);
  const cached = cache.get(key);
  if (cached) return cached;
  const errors = part.validate(parameters, state);
  if (errors.length) throw new Error(errors.join(' '));
  // The authored frame kernel proves surviving extrema against every real cutter.
  // Unproved cuts return undefined and retain the actual mesh path below.
  const proven = part === frame ? frameBounds(parameters) : undefined;
  if (proven) {
    const result = { min: [...proven.min] as Vec, max: [...proven.max] as Vec };
    cache.set(key, result);
    return result;
  }
  const model = withGeometryMode('simple', () =>
    (part.buildExportGeometry ?? part.buildGeometry)(parameters, state),
  );
  try {
    model.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(model, true);
    if (
      bounds.isEmpty() ||
      [...bounds.min.toArray(), ...bounds.max.toArray()].some((value) => !Number.isFinite(value))
    )
      throw new Error('Inspection requires a finite nonempty source envelope: ' + part.id);
    const result = { min: bounds.min.toArray() as Vec, max: bounds.max.toArray() as Vec };
    cache.set(key, result);
    if (cache.size > 512) cache.delete(cache.keys().next().value!);
    return result;
  } finally {
    disposeModel(model);
  }
}

/** Apply exactly the component/outer-pose transform used by componentGeometry and componentPython. */
export function placedInspectionBounds(
  bounds: InspectionBounds,
  piece: MillingPiece,
): InspectionBounds {
  const placement = piece.component.placement;
  const component = new Matrix4().makeRotationFromEuler(euler(placement.rotation));
  component.setPosition(...placement.translation);
  const outer = new Matrix4().makeRotationZ(((piece.angle ?? 0) * Math.PI) / 180);
  outer.setPosition(...(piece.position ?? [0, 0, piece.z ?? 0]));
  const placed = new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max)).applyMatrix4(
    outer.multiply(component),
  );
  return { min: placed.min.toArray() as Vec, max: placed.max.toArray() as Vec };
}

/** Resolve each distinct source configuration once, then retain complete rigid motion groups. */
export function millingInspectionBounds(
  libraries: readonly PartDefinition[],
  pieces: readonly MillingPiece[],
): InspectionGroupBounds {
  const definitions = new Map(libraries.map((part) => [part.id, part]));
  const boxes = new Map<Motion, Box3>();
  for (const piece of pieces) {
    const part = definitions.get(piece.component.libraryId);
    if (!part) throw new Error('Missing inspection library: ' + piece.component.libraryId);
    const bounds = placedInspectionBounds(configuredBounds(part, piece), piece);
    let group = boxes.get(piece.motion);
    if (!group) boxes.set(piece.motion, (group = new Box3()));
    group.union(new Box3(new Vector3(...bounds.min), new Vector3(...bounds.max)));
  }
  return Object.fromEntries(
    [...boxes].map(([motion, box]) => [
      motion,
      { min: box.min.toArray() as Vec, max: box.max.toArray() as Vec },
    ]),
  );
}

/** Separate complete assemblies along Y, preserving every internal mount and the fixed bed/equipment relationship. */
export function inspectionGroupOffsets(
  bounds: InspectionGroupBounds,
  gap = 100,
): Record<Motion, Vec> {
  if (!Number.isFinite(gap) || gap <= 0) throw new Error('Inspection spacing must be positive.');
  for (const group of Object.values(bounds))
    if (
      [...group.min, ...group.max].some((value) => !Number.isFinite(value)) ||
      group.min.some((value, axis) => value > group.max[axis])
    )
      throw new Error('Inspection group bounds must be finite and ordered.');
  const result: Record<Motion, Vec> = {
    fixed: [0, 0, 0],
    gantry: [0, 0, 0],
    x: [0, 0, 0],
    z: [0, 0, 0],
  };
  let previous = bounds.fixed?.max[1];
  for (const motion of groups.slice(1)) {
    const group = bounds[motion];
    if (!group) continue;
    if (previous === undefined) previous = group.min[1] - gap;
    result[motion] = [0, previous + gap - group.min[1], 0];
    previous = group.max[1] + result[motion][1];
  }
  return result;
}

export function millingInspectionOffsets(
  libraries: readonly PartDefinition[],
  pieces: readonly MillingPiece[],
) {
  return inspectionGroupOffsets(millingInspectionBounds(libraries, pieces));
}
