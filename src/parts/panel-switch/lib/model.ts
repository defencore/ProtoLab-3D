import type { Parameters } from '../../../core/types';
import type { Piece } from '../../../core/assembly/mechanical/assembly';
import * as assembly from '../../../core/assembly/mechanical/assembly';
import type { Shape } from '../../../core/assembly/mechanical/shapes';
import { cylinder, prism } from '../../../core/assembly/mechanical/shapes';
import { Mesh, MeshStandardMaterial } from 'three';
import {
  B,
  C,
  ring,
  poly,
  cut,
  union,
  move,
  rotate,
  finish,
  T,
} from '../../../core/assembly/mechanical/helpers';
import { daierColours, selected, type SwitchModel } from './catalog';

const metal = 0xb7bec6,
  plastic = 0x272e35,
  insulator = 0xa14737,
  copper = 0xc8b68b;
const hex = (acrossFlats: number, bore: number, height: number, z: number) =>
  cut(
    poly(
      Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI * i) / 3,
          r = acrossFlats / Math.sqrt(3);
        return [r * Math.cos(a), r * Math.sin(a)] as [number, number];
      }),
      height,
      z,
    ),
    C(bore, height + 2, z - 1),
  );
export const guardPivot = { y: -13, z: 11.5 };
/** Fixed photo-derived guard shell: open at the bottom and rear, with real wall thickness. */
export function guardShell(open: boolean): Shape {
  const shell = union(
    B(20, 34, 1.5, 0, 3, 31),
    B(1.5, 34, 22, -9.25, 3, 9.5),
    B(1.5, 34, 22, 9.25, 3, 9.5),
    B(17, 1.5, 13, 0, 19.25, 18.5),
  );
  const hinged = cut(shell, cylinder(1.65, 24, [-12, guardPivot.y, guardPivot.z], 'x'));
  return move(
    rotate(move(hinged, 0, -guardPivot.y, -guardPivot.z), open ? 110 : 0, 0, 0),
    0,
    guardPivot.y,
    guardPivot.z,
  );
}

/** SAC-01 outline dimensions follow the drawing; undimensioned curves and wall are illustrative. */
export const sac01 = { seat: 9.5, hingeY: -15.5, hingeZ: 5.2, opening: 69 };
const sideExtrusion = (profile: [number, number][], width: number): Shape =>
  rotate(prism(profile, width, -width / 2, 'y'), 0, 0, 90);
export function sac01Cover(open: boolean): Shape {
  const outer = sideExtrusion(
    [
      [-22.5, 13.8],
      [-12, 21.8],
      [15.5, 27.65],
      [17.3, 27.8],
      [18.8, 26.8],
      [19.3, 25],
      [18.9, 23.1],
      [17.4, 21.5],
      [15.9, 21.6],
      [14.8, 19.9],
      [14, 14.5],
      [14.7, 8],
      [13.5, 2.4],
      [11, 1.3],
      [8.5, 2.2],
      [6.5, 4],
      [-10.8, 4.3],
      [-12, 1.8],
      [-15.5, 0.9],
      [-18.6, 2],
      [-19.6, 5.2],
      [-19, 8.5],
    ],
    20,
  );
  const cavity = sideExtrusion(
    [
      [-27, -2],
      [16, -2],
      [16, 21.5],
      [17.4, 23.4],
      [17.7, 25.5],
      [15.5, 26.3],
      [-11.5, 20.3],
      [-21.2, 13.7],
      [-27, 13.7],
    ],
    17.6,
  );
  const shell = cut(outer, cavity, cylinder(1.6, 24, [-12, sac01.hingeY, sac01.hingeZ], 'x'));
  return rotate(
    move(
      rotate(move(shell, 0, -sac01.hingeY, -sac01.hingeZ), open ? sac01.opening : 0),
      0,
      sac01.hingeY,
      sac01.hingeZ + sac01.seat,
    ),
    0,
    0,
    90,
  );
}

function illuminatedToggle(
  m: SwitchModel,
  p: Parameters,
  add: (label: string, shape: Shape, color?: number) => void,
) {
  const [w, d, h] = m.body,
    b = m.bushing!,
    bh = m.bushingHeight!,
    colour = daierColours.find((colour) => colour.value === p.colour)!,
    angle = p.position === 'first' ? -12 : 12;
  const caseFrame = union(
    B(w, d, 0.8, 0, 0, -0.8),
    B(18, 0.4, h - 0.6, 0, d / 2 - 0.2, -h),
    B(18, 0.4, h - 0.6, 0, -d / 2 + 0.2, -h),
  );
  add('Insulating case', cut(B(w, d, h, 0, 0, -h), caseFrame), plastic);
  add('Metal case frame', caseFrame, metal);
  add(
    'M12 × 0.75 mounting bushing · nominal thread',
    cut(ring(b, 7.5, bh), B(1.1, 1.95, bh + 2, -5.65, 0, -1)),
    metal,
  );
  if (m.guarded) {
    add('Lower guard adjustment nut · illustrative position', hex(15.5, 12.1, 2.4, 6.8));
    add('Guard seat washer', ring(16, 12.1, 0.3, 9.2));
  } else {
    add('Panel washer', ring(16, 12.1, 0.5, 0.1));
    add('Panel retaining nut', hex(15.5, 12.1, 2.4, 0.6));
    add('Panel locking nut', hex(15.5, 12.1, 2.4, 3 + Number(p.panelThickness)));
  }
  const dome: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const radius = 3.5 * (1 - i / 16);
    dome.push([radius, 1.5 * (1 - (radius / 3.5) ** 2)]);
  }
  const radians = (12 * Math.PI) / 180,
    domeProjection = Math.max(
      ...dome.map(([r, z]) => r * Math.sin(radians) + z * Math.cos(radians)),
    ),
    shaftLength = (m.leverLength! - domeProjection) / Math.cos(radians);
  // The 19.9 mm source dimension is the projection above the bushing in a tilted position.
  // Travel follows the 28 mm case length: the manufacturer's front view is the X/Z plane.
  add('Chrome toggle actuator', move(rotate(C(7, shaftLength), 0, angle), 0, 0, bh), metal);
  const lensProfile: [number, number][] = [
    [0, shaftLength],
    [3.5, shaftLength],
  ];
  for (let i = 1; i <= 16; i++) {
    const [radius, height] = dome[i];
    lensProfile.push([radius, shaftLength + height]);
  }
  add('Coloured LED actuator lens', move(rotate(T(lensProfile), 0, angle), 0, 0, bh), colour.color);
  for (const [index, x] of [-12.1, 12.1].entries())
    add(
      `6.3 mm quick-connect ${index === 0 ? 'supply' : 'load'} terminal`,
      cut(B(0.8, 6.3, 10.3, x, 0, -h - 10.3), cylinder(1, 2, [x - 1, 0, -h - 6.6], 'x')),
      copper,
    );
  add(
    '6.3 mm quick-connect lamp-ground terminal · horizontal',
    cut(B(9, 6.3, 0.8, -18.5, 0, -3), C(2, 2, -3.5, -20.3)),
    copper,
  );
  if (!m.guarded) return;
  const plate = poly(
    [
      [-7.3, 13.3],
      [-8.5, 12.1],
      [-8.5, -18.7],
      [-7.5, -18.7],
      [-7.5, -26.1],
      [-6.3, -27.3],
      [6.3, -27.3],
      [7.5, -26.1],
      [7.5, -18.7],
      [8.5, -18.7],
      [8.5, 12.1],
      [7.3, 13.3],
    ],
    0.9,
    sac01.seat,
  );
  const ears = [-7.4, 7.4].map((x) =>
    union(
      B(1.6, 8.6, 4.4, x, sac01.hingeY, sac01.seat + 0.7),
      cylinder(4.3, 1.6, [x - 0.8, sac01.hingeY, sac01.seat + sac01.hingeZ], 'x'),
    ),
  );
  // The A-view tongue faces the free front along the base length; after clocking it faces -X.
  const keyedBore = cut(C(12, 3, sac01.seat - 1), B(1.7, 1, 5, 0, 5.7, sac01.seat - 2));
  add(
    'SAC-01 keyed steel mounting base and hinge ears',
    rotate(
      cut(
        union(plate, ...ears),
        keyedBore,
        cylinder(1.6, 24, [-12, sac01.hingeY, sac01.seat + sac01.hingeZ], 'x'),
      ),
      0,
      0,
      90,
    ),
    0x343b40,
  );
  add('Upper guard retaining nut', hex(15.5, 12.1, 1.8, 10.4));
  add(
    'SAC-01 steel hinge pin · spring omitted',
    rotate(
      union(
        cylinder(1.5, 20.4, [-10.2, sac01.hingeY, sac01.seat + sac01.hingeZ], 'x'),
        cylinder(2.1, 0.5, [-10.7, sac01.hingeY, sac01.seat + sac01.hingeZ], 'x'),
      ),
      0,
      0,
      90,
    ),
    metal,
  );
  add('SAC-01 transparent coloured protective cover', sac01Cover(p.guard === 'open'), colour.color);
}

function toggle(
  m: SwitchModel,
  p: Parameters,
  add: (label: string, shape: Shape, color?: number) => void,
) {
  const [w, d, h] = m.body,
    b = m.bushing!,
    bh = m.bushingHeight!,
    large = b > 10;
  add('Insulating case', B(w - 0.6, d - 0.6, h - 0.3, 0, 0, -h), insulator);
  add(
    'Metal case frame',
    cut(B(w, d, h, 0, 0, -h), B(w - 0.6, d - 0.6, h - 0.29, 0, 0, -h - 0.01)),
    metal,
  );
  add('Threaded mounting bushing · nominal thread', ring(b, large ? 4.4 : 3.4, bh), metal);
  add('Panel retaining nut', hex(large ? 14 : 8, b + 0.14, large ? 2 : 1.4, large ? 5 : 3), metal);
  const closed = m.guarded && p.guard === 'closed';
  const angle = closed
    ? 26
    : p.position === 'first'
      ? large
        ? 26
        : 25
      : p.position === 'last'
        ? large
          ? -26
          : -25
        : 0;
  const ld = large ? 3.6 : 2.92;
  add('Toggle lever', move(rotate(C(ld, m.leverLength!), angle, 0, 0), 0, 0, bh), metal);
  const pitch = large ? 6 : 4.7,
    yPitch = large ? 6 : 4.83,
    terminalLength = large ? 5 : 3.94;
  for (let pole = 0; pole < m.poles; pole++)
    for (let pin = 0; pin < 3; pin++)
      add(
        `Solder terminal ${pole * 3 + pin + 1}`,
        B(
          large ? 2.4 : 2.03,
          0.76,
          terminalLength,
          (pin - 1) * pitch,
          (pole - (m.poles - 1) / 2) * yPitch,
          -h - terminalLength,
        ),
        copper,
      );
  if (m.guarded) {
    add(
      'Guard mounting base',
      cut(
        union(B(24, 30, 1.2, 0, 1, 7.5), B(1.8, 5, 6, -11.3, -12, 8), B(1.8, 5, 6, 11.3, -12, 8)),
        C(12.1, 8, 5),
        cylinder(1.65, 28, [-14, guardPivot.y, guardPivot.z], 'x'),
      ),
      plastic,
    );
    add('Guard upper adjustment nut', hex(14, b + 0.14, 2, 8.8), metal);
    add('Guard hinge pin', cylinder(1.45, 25.2, [-12.6, guardPivot.y, guardPivot.z], 'x'), metal);
    add('Red protective cover · approximate profile', guardShell(p.guard === 'open'), 0xcc342a);
  }
}

export function pieces(p: Parameters, state: string): Piece[] {
  const m = selected(p.model),
    out: Piece[] = [];
  const add = (label: string, shape: Shape, color = metal) => out.push({ label, shape, color });
  if (m.illuminated) {
    illuminatedToggle(m, p, add);
  } else if (m.form === 'toggle') {
    toggle(m, p, add);
  } else if (m.form === 'rocker') {
    const [w, d, h] = m.body;
    const opening = B(16, 10.4, 12, 0, 0, -4);
    add(
      'Snap-in housing and bezel',
      cut(
        union(
          B(w, d, h, 0, 0, -h),
          B(20.8, 14.8, 2),
          B(1, 9, 5, -9.1, 0, -8),
          B(1, 9, 5, 9.1, 0, -8),
        ),
        opening,
      ),
      plastic,
    );
    const angle = p.position === 'first' ? 10 : p.position === 'last' ? -10 : 0;
    add(
      'Rocker actuator',
      move(rotate(B(15.6, 10, 3.6, 0, 0, -1.8), 0, angle, 0), 0, 0, 1.6),
      0x39424b,
    );
    for (let i = 0; i < m.terminalCount; i++) {
      const x = m.terminalCount === 2 ? (i - 0.5) * 7 : (i - 1) * 7;
      add(`Quick-connect terminal ${i + 1}`, B(0.8, 4.8, 6.6, x, 0, -h - 6.6), copper);
    }
  } else if (m.form === 'rotary') {
    const h = m.body[2],
      b = m.bushing!,
      bh = m.bushingHeight!;
    add('Rotary switch case', C(26.19, h, -h), plastic);
    add('Threaded mounting bushing · nominal thread', ring(b, 6.45, bh), metal);
    add('Panel retaining nut', hex(12.7, b + 0.14, 1.65, 3), metal);
    const index =
      p.position === 'first'
        ? 0
        : p.position === 'last'
          ? m.positions - 1
          : Math.floor((m.positions - 1) / 2);
    const shaft = cut(C(6.35, m.leverLength!), B(10, 5, m.leverLength! + 2, 0, 4.835, -1));
    add('D-flat selector shaft', move(rotate(shaft, 0, 0, index * 30), 0, 0, bh), metal);
    for (let i = 0; i < m.positions; i++) {
      const a = ((15 + i * 30) * Math.PI) / 180;
      add(
        `Selected circuit solder terminal ${i + 1}`,
        move(
          rotate(B(2.21, 0.51, 6.35, 0, 0, -h - 6.35), 0, 0, i * 30),
          11.1 * Math.cos(a),
          11.1 * Math.sin(a),
        ),
        copper,
      );
    }
    add('Common solder terminal A', B(2.21, 0.51, 6.35, 3.85, 0, -h - 6.35), copper);
  } else if (m.form === 'pushbutton') {
    const h = m.body[2],
      front = m.height!,
      latching = m.behavior === 'Latching';
    const keyedBody = cut(
      C(16, h, -h),
      B(30, 10, h + 2, 0, 12.65, -h - 1),
      B(30, 10, h + 2, 0, -12.65, -h - 1),
    );
    add(
      'Threaded switch body and bezel · nominal thread',
      cut(union(keyedBody, C(18.5, front)), C(12.1, h + front + 2, -h - 1)),
      metal,
    );
    add('Rear insulating terminal support', C(12.05, 2, -h), plastic);
    const pressed = p.position === 'last' ? (latching ? 2.3 : 2) : 0;
    add('Button actuator', C(10.5, 3.5, front - 3.5 - pressed), metal);
    add(
      'Illuminated ring',
      ring(12, 10.6, 0.45, front - 0.45 - pressed),
      latching ? 0x58b477 : 0x489dea,
    );
    add('Panel retaining nut', hex(19, 16.14, 2, -5), metal);
    const terminalLength = latching ? 4.5 : 4,
      terminalWidth = latching ? 2 : 2.74;
    const locations: [number, number][] = latching
      ? [
          [-4.7, 0],
          [4.7, 0],
          [0, -4.375],
          [0, 4.375],
        ]
      : [
          [0, -4.7],
          [0, 4.7],
          [-4.7, 0],
          [4.7, 0],
        ];
    locations.forEach(([x, y], i) =>
      add(
        `${i < 2 ? 'Switch' : 'LED'} solder terminal ${i + 1}`,
        B(
          Math.abs(x) > 0 ? 0.5 : terminalWidth,
          Math.abs(x) > 0 ? terminalWidth : 0.5,
          terminalLength,
          x,
          y,
          -h - terminalLength,
        ),
        copper,
      ),
    );
  } else {
    const [side, , h] = m.body,
      [pitchX, pitchY] = m.pitch!,
      ld = m.leverLength!;
    add('Tactile switch insulating body', cut(B(side, side, h), C(ld + 0.15, 2, h - 0.5)), plastic);
    add('Steel lid', cut(B(side - 0.3, side - 0.3, 0.3, 0, 0, h), C(ld + 0.15, 1, h - 0.1)), metal);
    const drop = p.position === 'last' ? 0.2 : 0;
    add('Tactile plunger', C(ld, m.height! - h, h - drop), 0xddd3af);
    for (let xSign = -1; xSign <= 1; xSign += 2)
      for (let ySign = -1; ySign <= 1; ySign += 2) {
        const x = (xSign * pitchX) / 2,
          y = (ySign * pitchY) / 2;
        add(
          `PCB terminal ${out.length - 2}`,
          union(
            B(0.7, 0.3, 3.5, x, y, -3.5),
            B(
              Math.abs(x) - side / 2 + 0.45,
              0.3,
              0.3,
              (xSign * (side / 2 + Math.abs(x))) / 2,
              y,
              -0.3,
            ),
          ),
          copper,
        );
      }
  }
  return finish(out, state);
}

/** Preview appearance only; native export preserves the same surfaces and their RGB colours. */
export function geometry(p: Parameters, state: string) {
  const group = assembly.geometry(pieces(p, state));
  group.traverse((item) => {
    if (item instanceof Mesh && item.name === 'SAC-01 transparent coloured protective cover') {
      const material = item.material as MeshStandardMaterial;
      material.transparent = true;
      material.opacity = 0.55;
      material.depthWrite = false;
      material.roughness = 0.25;
      material.metalness = 0.05;
    }
  });
  return group;
}
