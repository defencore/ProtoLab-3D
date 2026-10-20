import assert from 'node:assert/strict';
import test from 'node:test';
import { Euler, Vector3 } from 'three';
import type { Parameters } from '../src/core/types';
import type { Vec } from '../src/core/assembly/boundary/shapes';
import machine, { millingComponents } from '../src/parts/cnc-milling-machine/part';
import type { MillingPiece } from '../src/parts/cnc-milling-machine/lib/composition';
import { frameHoles } from '../src/parts/cnc-frame-part/lib/model';
import { carriageMountingHoles } from '../src/parts/cnc-guide-carriage/part';
import { worktableLayout } from '../src/parts/cnc-worktable/lib/layout';
import { spindleMountLayout } from '../src/parts/cnc-spindle-mount/lib/model';

function transformed(piece: MillingPiece, vector: Vec, direction = false) {
  const placement = piece.component.placement;
  const result = new Vector3(...vector).applyEuler(
    new Euler(...(placement.rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'),
  );
  return direction ? result : result.add(new Vector3(...placement.translation));
}
interface BlindTap {
  identity: string;
  diameter: number;
  origin: Vector3;
  direction: Vector3;
  depth: number;
}
function blindTaps(pieces: MillingPiece[]): BlindTap[] {
  const result: BlindTap[] = [];
  for (const piece of pieces) {
    const { libraryId, parameters: p, id } = piece.component;
    const add = (diameter: number, origin: Vec, direction: Vec, depth: number) =>
      result.push({
        identity: id,
        diameter,
        origin: transformed(piece, origin),
        direction: transformed(piece, direction, true),
        depth,
      });
    if (libraryId === 'cnc-frame-part') {
      // Hollow members have an internal free surface; they do not have this solid-stock floor.
      if (['bed-member', 'gantry-beam', 'stand-leg'].includes(String(p.role))) continue;
      const size = [p.sizeX, p.sizeY, p.sizeZ].map(Number);
      for (const hole of frameHoles(p)) {
        if (!hole.threadPitch) continue;
        // These transverse taps exit the real tube wall into its open interior.
        // A modeled cutter end in that air is not a closed blind-hole floor.
        if (
          ['table-rib-tube', 'y-tiebar', 'corner-leg'].includes(String(p.role)) &&
          hole.axis !== p.tubeAxis &&
          hole.depth >= Number(p.wall)
        )
          continue;
        const axis = ['x', 'y', 'z'].indexOf(hole.axis);
        const lo = hole.at[axis],
          hi = lo + hole.depth;
        if (lo <= -size[axis] / 2 + 0.11 && hi >= size[axis] / 2 - 0.11) continue;
        const normal: Vec = [0, 0, 0];
        normal[axis] = 1;
        add(hole.diameter, hole.at, normal, hole.depth);
      }
    } else if (libraryId === 'cnc-guide-carriage') {
      for (const [x, y, z] of carriageMountingHoles()) add(5, [x, y, z - 6], [0, 0, 1], 6);
    } else if (libraryId === 'cnc-worktable') {
      for (const hole of worktableLayout(p).holes)
        if (hole.threaded) add(hole.diameter, hole.center, [0, 0, 1], hole.depth);
    } else if (libraryId === 'cnc-spindle-mount' && p.component === 'back') {
      const layout = spindleMountLayout(p);
      for (const [x, , z] of layout.clampBoltCenters)
        add(
          layout.clampBoltDiameter,
          [x, layout.backSplitY - layout.clampThreadDepth, z],
          [0, 1, 0],
          layout.clampThreadDepth,
        );
      for (const origin of layout.rearMountHoleCenters)
        add(layout.mountBoltDiameter, origin, [0, 1, 0], layout.mountThreadDepth);
    }
  }
  return result;
}

// Independent world-space stack calculation: a valid boolean intersection alone cannot detect
// a screw that bottoms on the closed hole floor instead of applying clamp preload.
function checkEngagement(parameters: Parameters) {
  const pieces = millingComponents(parameters),
    taps = blindTaps(pieces);
  let checked = 0;
  for (const piece of pieces) {
    if (piece.component.libraryId !== 'bolt-screw') continue;
    const p = piece.component.parameters;
    const normal = transformed(piece, [0, 0, 1], true);
    const seat = transformed(piece, [0, 0, 0]).addScaledVector(
      normal,
      (Number(p.length) - Number(p.headHeight)) / 2,
    );
    const tip = seat.clone().addScaledVector(normal, -Number(p.length));
    for (const tap of taps) {
      if (
        Math.abs(Number(p.diameter) - tap.diameter) > 0.001 ||
        Math.abs(Math.abs(normal.dot(tap.direction)) - 1) > 0.000001
      )
        continue;
      const offset = seat.clone().sub(tap.origin),
        axial = offset.dot(tap.direction);
      if (offset.clone().addScaledVector(tap.direction, -axial).length() > 0.001) continue;
      const tipPosition = tip.clone().sub(tap.origin).dot(tap.direction);
      const engagement =
        Math.min(Math.max(tipPosition, axial), tap.depth) -
        Math.max(Math.min(tipPosition, axial), 0);
      if (engagement <= 0.01) continue;
      checked++;
      const reserve = normal.dot(tap.direction) > 0 ? tipPosition : tap.depth - tipPosition;
      const label = `${parameters.spindle}: ${piece.component.id} / ${tap.identity}`;
      assert.ok(
        reserve >= 1 - 0.000001,
        `${label} bottoms in the blind tap (${reserve} mm reserve)`,
      );
      assert.ok(
        engagement >= tap.diameter - 0.000001,
        `${label} has insufficient nominal engagement (${engagement} mm)`,
      );
    }
  }
  assert.ok(
    checked >= 380,
    `The audit did not reach the expected frame, carriage, table and clamp blind joints: ${checked}`,
  );
}

test('CNC blind fasteners have tip reserve and nominal engagement across all spindle sizes and table heights', () => {
  for (const option of machine.parameters.find((p) => p.key === 'spindle')!.options!)
    checkEngagement({ ...machine.defaults, spindle: option.value });
  for (const tableHeight of [700, 950]) checkEngagement({ ...machine.defaults, tableHeight });
});
