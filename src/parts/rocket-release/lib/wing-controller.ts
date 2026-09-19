import { wingLayout } from './wing-layout';
import type { Parameters } from '../../../core/types';
import type { Piece } from './assembly';
import {
  box,
  circle,
  plate,
  cylinder,
  union,
  subtract,
  transform,
  rotate,
  type Shape,
  type Point,
} from './shapes';
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
export const controllerMounts = (p: Parameters): Point[] =>
  [-1, 1].flatMap((x) =>
    [-1, 1].map((y) => [(x * +p.wingHolePitchX) / 2, (y * +p.wingHolePitchY) / 2] as Point),
  );
export const controllerBottomScrew = (p: Parameters, x: number, y: number): Shape =>
  transform(rotate(p.wingBattery === '2x18650' ? flatScrew(4) : screw(2, 6), 180, 'x'), 0, [
    x,
    y,
    p.wingBattery === '2x18650' ? -2 : 3,
  ]);
const rect = (x: number, y: number, w: number, h: number): Point[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const welded = (solid: Shape): Shape => ({
  kind: 'fusedLayers',
  children: [solid],
  planes: [],
  solid,
});
export function controllerPieces(p: Parameters): Piece[] {
  const out: Piece[] = [];
  const add = (label: string, shape: Shape, color = 0x293c32) =>
    out.push({ label, shape: controllerPlacement(p, shape), color });
  const mounts = controllerMounts(p),
    holes = mounts.map(([x, y]) => circle(1.1, x, y));
  add(
    'BUY SpeedyBee F405 WING-MINI · shield C · standard orientation · FR4 t1 · outline fit reference',
    plate(rect(-18.5, -13, 37, 26), holes, 0, 1),
  );
  add(
    'BUY SpeedyBee F405 WING-MINI · FC board B · 37×26 · FR4 t1 · pitch fit reference',
    plate(rect(-18.5, -13, 37, 26), holes, 4, 1),
  );
  add(
    'BUY SpeedyBee F405 WING-MINI · PDB board A · FR4 t1 · outline fit reference',
    plate(rect(-10.7, -13, 24.7, 26), holes, 11.5, 1),
  );
  for (const [i, y] of [-4, 2].entries())
    add(
      `BUY WING MINI ${i === 0 ? 'BAT+' : 'GND'} solder pad · copper · placement reference`,
      box([4, 4, 0.05], [9.5, y, 12.5]),
      0xb99450,
    );
  // Separate physical components retain open air between the boards, access to
  // the side plugs, and an unobstructed barometer. No solid installation box.
  add(
    'BUY WING MINI STM32F405 package · placement reference',
    box([7, 7, 1.2], [-3.5, -3.5, 5]),
    0x15171b,
  );
  add(
    'BUY WING MINI MicroSD socket · placement reference',
    box([5, 11, 1.5], [10, -5.5, 5]),
    0xa6adb2,
  );
  add(
    'BUY WING MINI barometer · placement reference · keep vent clear',
    box([2.5, 2.5, 0.8], [1, 5.5, 3.2]),
    0xb0b5ba,
  );
  for (const [i, y] of [-8, 0, 8].entries())
    add(
      `BUY WING MINI SH1.0 connector ${i + 1} · cable-side access · envelope reference`,
      subtract(box([4, 6, 2.3], [13, y - 3, 1.7]), box([2.8, 4.8, 1.3], [14.3, y - 2.4, 2.2])),
      0xeee8d3,
    );
  add(
    'BUY WING MINI PDB interconnect · pin housing envelope',
    box([8, 3, 6.5], [-4, -8, 5]),
    0x25272b,
  );
  add(
    'BUY WING MINI servo BEC inductor · placement reference',
    box([5, 5, 3], [-2, -2.5, 8.5]),
    0x4d4f55,
  );
  add(
    'BUY WING MINI PWM1–9 and SBUS header · 2.54 mm pitch · housing',
    box([7.62, 25.4, 2.5], [-18.5, -12.7, 5]),
    0x24262a,
  );
  for (let col = 0; col < 3; col++)
    for (let row = 0; row < 10; row++)
      add(
        `BUY WING MINI header pin ${col + 1}.${row + 1} · brass 0.64 square · 2.54 pitch`,
        box([0.64, 0.64, 6], [-17.55 + col * 2.54, -11.75 + row * 2.54, 7.5]),
        0xb99450,
      );
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
      );
      add(
        `WING MINI damper upper stud ${i + 1} · bonded steel · M2×0.4×3 · flange t0.7 · custom fit reference`,
        welded(union(cylinder(2.5, 0.7, [x, y, -0.7]), upperStud)),
        0x929eac,
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
        DrawingStatus:
          'PROVISIONAL bonded isolator; select compound, stiffness, bond process and load limits before manufacture',
        Isolation: 'Separate metal ends; 1.1 mm elastomer between embedded ends; no through-bolt',
      };
    }
    const topScrew = screw(2, 3.5, { head: 'pan', headDiameter: 3.5, headHeight: 1.3 });
    if (topScrew.kind !== 'fastener') throw new Error('Expected supplied screw');
    topScrew.parameters = {
      ...topScrew.parameters,
      drive: 'cross',
      driveWidth: 2,
      driveThickness: 0.5,
      driveDepth: 0.7,
    };
    const top = transform(topScrew, 0, [x, y, 9]);
    const male: Shape = {
      kind: 'thread',
      diameter: 2,
      pitch: 0.4,
      length: 3,
      clearance: 0,
      internal: false,
    };
    add(
      `BUY WING MINI M2×3+3 copper male-female standoff ${i + 1} · Ø3.2 fit reference`,
      welded(
        subtract(
          union(cylinder(1.6, 3, [x, y, 1]), transform(male, 0, [x, y, 4])),
          isolated
            ? transform(
                {
                  kind: 'thread',
                  diameter: 2,
                  pitch: 0.4,
                  length: 3,
                  clearance: 0.04,
                  internal: true,
                },
                0,
                [x, y, 0],
              )
            : matingHole(bottom),
        ),
      ),
      0xb99450,
    );
    add(
      `BUY WING MINI M2×6.5 copper female-female standoff ${i + 1} · Ø3.2 fit reference`,
      subtract(
        cylinder(1.6, 6.5, [x, y, 5]),
        transform({ ...male, internal: true, clearance: 0.04 }, 0, [x, y, 4]),
        matingHole(top),
      ),
      0xb99450,
    );
    add(
      `WING MINI frame screw ${i + 1} · M2×0.4×${isolated ? 4 : 6}${isolated ? ' · countersunk 90° · damper lower end only' : ''}`,
      bottom,
      0x929eac,
    );
    add(`WING MINI supplied top screw ${i + 1} · cross pan head · M2×0.4×3.5`, top, 0x929eac);
    if (!isolated)
      add(
        `WING MINI shield isolation pad ${i + 1} · silicone Ø5/2.2×1`,
        plate(circle(2.5, x, y), [circle(1.1, x, y)], -1, 1),
        0x373e43,
      );
  });
  return out;
}
