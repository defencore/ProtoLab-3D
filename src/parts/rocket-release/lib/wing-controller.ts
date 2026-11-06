import { wingLayout } from './wing-layout';
import {
  wingMiniPieces,
  wingMiniMounts,
  wingMiniModel,
  wingMiniDefaults,
} from '../../flight-controller/lib/wing-mini';
import { markSupplierUnit } from '../../../core/supplier-components';
import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  circle,
  plate,
  cylinder,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
} from '../../../core/assembly/recovery/shapes';
import { screw, flatScrew, matingHole } from './hardware';

// Standard orientation from SpeedyBee manual V1.2. Only the stack envelope and
// spacer lengths are dimensioned by the supplier. PCB outlines, pitch and component
// positions are fit references; they must not be mistaken for an OEM STEP model.
export const controllerPlacement = (p: Parameters, shape: Shape) => {
  const w = wingLayout(p);
  // Put the tall PLS bank opposite the offset cells. This keeps its wire-bend
  // envelope clear of the closed retention collars after adding the dampers.
  return transform(rotate(shape, 180, 'x'), w.cylindrical ? 180 : 0, [
    w.controllerX,
    0,
    w.controllerZ,
  ]);
};
export const controllerMounts = wingMiniMounts;
export const controllerBottomScrew = (p: Parameters, x: number, y: number): Shape =>
  transform(rotate(p.wingBattery === '2x18650' ? flatScrew(4) : screw(2, 6), 180, 'x'), 0, [
    x,
    y,
    p.wingBattery === '2x18650' ? -2 : 3,
  ]);
const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  planes: [],
  solid,
});
export function controllerPieces(p: Parameters): Piece[] {
  const out: Piece[] = [];
  const kit = wingMiniPieces(p);
  markSupplierUnit(
    kit.map((piece) => piece.shape),
    {
      name: 'SpeedyBee F405 WING-MINI board stack and supplied mounting hardware',
      libraryId: 'flight-controller',
      presetId: wingMiniModel,
      parameters: {
        model: wingMiniModel,
        ...wingMiniDefaults,
        wingHolePitchX: p.wingHolePitchX ?? wingMiniDefaults.wingHolePitchX,
        wingHolePitchY: p.wingHolePitchY ?? wingMiniDefaults.wingHolePitchY,
      },
      state: 'assembled',
      procurement: {
        designation: 'SpeedyBee F405 WING MINI',
        manufacturer: 'SpeedyBee',
        source: 'https://www.speedybee.com/f405-wing-mini-download/',
      },
    },
  );
  const supplierUnit = {
    SupplierUnitId: 'speedybee-f405-wing-mini-kit',
    SupplierUnitName: 'SpeedyBee F405 WING-MINI board stack and supplied mounting hardware',
    SupplierManufacturer: 'SpeedyBee',
    SupplierSource: 'https://www.speedybee.com/f405-wing-mini-download/',
    SupplierScope:
      'One complete supplier kit; individual board components and pins are installation references. Verify the supplied mounting hardware and actual interfaces.',
  };
  out.push(
    ...kit.map((piece) => ({
      ...piece,
      shape: controllerPlacement(p, piece.shape),
      metadata: supplierUnit,
    })),
  );
  const add = (label: string, shape: Shape, color = 0x293c32, metadata?: Record<string, string>) =>
    out.push({ label, shape: controllerPlacement(p, shape), color, metadata });
  const mounts = controllerMounts(p);
  mounts.forEach(([x, y], i) => {
    const isolated = p.wingBattery === '2x18650';
    const bottom = controllerBottomScrew(p, x, y);
    const upperStud: Shape = transform(
      { kind: 'thread', diameter: 2, pitch: 0.4, length: 3, clearance: 0, internal: false },
      0,
      [x, y, 0],
    );
    // Two separately bonded metal ends; no through-stud bridges the elastomer.
    if (isolated) {
      add(
        `WING MINI damper lower insert ${i + 1} · bonded steel · M2 female depth2 · custom fit reference`,
        subtract(cylinder(2.5, 2.2, [x, y, -4]), matingHole(bottom)),
        0x929eac,
        { SourceProcess: 'TURN / DRILL / TAP', SourceMaterial: 'steel; grade to specify' },
      );
      add(
        `WING MINI damper upper stud ${i + 1} · bonded steel · M2×0.4×3 · flange t0.7 · custom fit reference`,
        welded(union(cylinder(2.5, 0.7, [x, y, -0.7]), upperStud)),
        0x929eac,
        { SourceProcess: 'TURN / THREAD', SourceMaterial: 'steel; grade to specify' },
      );
      add(
        `WING MINI bonded elastomer damper ${i + 1} · silicone Ø6×4 envelope · separate inserts · stiffness TBD`,
        welded(
          subtract(
            cylinder(3, 4, [x, y, -4]),
            cylinder(2.5, 2.3, [x, y, -4.1]),
            cylinder(2.5, 0.8, [x, y, -0.7]),
          ),
        ),
        0x363e47,
      );
      out[out.length - 1].metadata = {
        SourceProcess: 'MOULD / BOND',
        SourceMaterial: 'silicone; compound to specify',
        DrawingStatus:
          'PROVISIONAL bonded isolator; select compound, stiffness, bond process and load limits before manufacture',
        Isolation: 'Separate metal ends; 1.1 mm elastomer between embedded ends; no through-bolt',
      };
    }
    add(
      `WING MINI frame screw ${i + 1} · M2×0.4×${isolated ? 4 : 6}${isolated ? ' · countersunk 90° · damper lower end only' : ''}`,
      bottom,
      0x929eac,
      { SourceProcess: 'BUY', SourceMaterial: 'stainless steel; supplied grade to confirm' },
    );
    if (!isolated)
      add(
        `WING MINI shield isolation pad ${i + 1} · silicone Ø5/2.2×1`,
        plate(circle(2.5, x, y), [circle(1.1, x, y)], -1, 1),
        0x373e43,
        { SourceProcess: 'CUT', SourceMaterial: 'silicone; compound to specify' },
      );
  });
  return out;
}
