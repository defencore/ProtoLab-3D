import { Box3, Group, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import { disposeModel } from '../../../core/mechanical';
import { recoveryDetailPython } from '../../../core/assembly/recovery/python';
import {
  box,
  circle,
  plate,
  cylinder,
  union,
  subtract,
  transform,
  component,
  type Shape,
  type Point,
} from '../../../core/assembly/recovery/shapes';

export const wingMiniModel = 'speedybee-f405-wing-mini';
export const wingMiniDefaults: Parameters = { wingHolePitchX: 18, wingHolePitchY: 22 };
export interface WingMiniPiece {
  label: string;
  shape: Shape;
  color: number;
}
export const wingMiniMounts = (p: Parameters): Point[] =>
  [-1, 1].flatMap((x) =>
    [-1, 1].map(
      (y) =>
        [
          (x * +(p.wingHolePitchX ?? wingMiniDefaults.wingHolePitchX)) / 2,
          (y * +(p.wingHolePitchY ?? wingMiniDefaults.wingHolePitchY)) / 2,
        ] as Point,
    ),
  );
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
function suppliedTopScrew(): Shape {
  return {
    kind: 'fastener',
    parameters: {
      diameter: 2,
      length: 3.5,
      shankDiameter: 2,
      head: 'pan',
      headSize: 3.5,
      headHeight: 1.3,
      headSides: 6,
      flangeDiameter: 4.6,
      flangeThickness: 0.4,
      neckSize: 2,
      neckHeight: 0,
      countersinkAngle: 90,
      drive: 'cross',
      driveWidth: 2,
      driveThickness: 0.5,
      driveDepth: 0.7,
      driveSides: 6,
      threadMode: 'envelope',
      threadSpan: 'full',
      pitch: 0.4,
      handedness: 'right',
      threadStart: 0,
      threadLength: 3.5,
      tip: 'chamfer',
      tipLength: 0.2,
      tipDiameter: 1.8,
    },
  };
}
/** Manual V1.2 envelope and spacers; undimensioned features remain installation references. */
export function wingMiniPieces(p: Parameters, state = 'assembled'): WingMiniPiece[] {
  const out: WingMiniPiece[] = [];
  const add = (label: string, shape: Shape, color = 0x293c32) => out.push({ label, shape, color });
  const mounts = wingMiniMounts(p),
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
    const topScrew = suppliedTopScrew();
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
          transform(
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
          ),
        ),
      ),
      0xb99450,
    );
    add(
      `BUY WING MINI M2×6.5 copper female-female standoff ${i + 1} · Ø3.2 fit reference`,
      welded(
        subtract(
          cylinder(1.6, 6.5, [x, y, 5]),
          transform({ ...male, internal: true, clearance: 0.04 }, 0, [x, y, 4]),
          transform({ ...male, internal: true, clearance: 0.04, length: 3.5 }, 0, [x, y, 9]),
        ),
      ),
      0xb99450,
    );
    add(`WING MINI supplied top screw ${i + 1} · cross pan head · M2×0.4×3.5`, top, 0x929eac);
  });
  if (state === 'exploded')
    return out.map((piece) => {
      const layer = /shield|M2×3\+3/.test(piece.label)
        ? 0
        : /PDB board|BAT\+|GND solder|M2×6.5|top screw/.test(piece.label)
          ? 2
          : 1;
      return { ...piece, shape: transform(piece.shape, 0, [0, 0, layer * 12]) };
    });
  return out;
}
export const wingMiniGeometry = (p: Parameters, state: string) =>
  new Group().add(
    ...wingMiniPieces(p, state).map((piece) => component(piece.shape, piece.label, piece.color)),
  );
export function wingMiniDimensions(p: Parameters, state: string): [number, number, number] {
  const model = wingMiniGeometry(p, state);
  try {
    model.updateMatrixWorld(true);
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}
export function wingMiniPython(p: Parameters, state: string): string {
  const pieces = wingMiniPieces(p, state);
  return [
    'components=[]',
    '_wing_metadata=[]',
    ...pieces.flatMap((piece) => [
      recoveryDetailPython(piece.shape),
      'components.append(shape.removeSplitter())',
      '_wing_metadata.append(component_metadata[0])',
    ]),
    'shape=Part.makeCompound(components)',
    'component_metadata=_wing_metadata',
    `component_labels=${JSON.stringify(pieces.map((piece) => piece.label))}`,
    `component_colors=${JSON.stringify(pieces.map((piece) => [16, 8, 0].map((shift) => ((piece.color >> shift) & 255) / 255)))}`,
  ].join('\n');
}
