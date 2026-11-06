import type { Parameters } from '../../../core/types';
import {
  box,
  cylinder,
  union,
  pythonShape,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { pi5Interface } from '../../raspberry-pi/part';
import {
  guidedLayout,
  guidedPowerPassage,
  guidedGpioReserve,
  worldPoint,
  at,
} from './guided-layout';

/** Authored external power-wire allowance, distinct from sourced connector geometry. */
export function guidedPowerPlan(p: Parameters) {
  const a = guidedLayout(p);
  const gpioPins = [4, 6].map((number) => {
    const pin = pi5Interface.gpio.pins.find((p) => p.number === number);
    if (!pin) throw new Error('Missing sourced GPIO pin ' + number);
    return pin;
  });
  const gpioTips = gpioPins.map((pin) => worldPoint(pin.tip, a.pi));
  const gpioCenter = [0, 1, 2].map(
    (axis) => gpioTips.reduce((sum, tip) => sum + tip[axis], 0) / gpioTips.length,
  ) as Vec;
  const passage = guidedPowerPassage;
  const wireRadius = passage.diameter / 2;
  const wireStart: Vec = [gpioCenter[0] - 10 + 0.2, gpioCenter[1], gpioCenter[2]];
  const turnX = wireStart[0] - 0.2;
  const middleYZ: Vec = [
    turnX - Math.hypot(passage.y - gpioCenter[1], passage.z - gpioCenter[2]) / 2,
    (gpioCenter[1] + passage.y) / 2,
    (gpioCenter[2] + passage.z) / 2,
  ];
  const socket = worldPoint([43.5, 15, -7], a.ups);
  const outputFarX = socket[0] + 9;
  const crossX = socket[0] + 14,
    bend = 4;
  const lowZ = socket[2];
  const diagonal = bend / Math.SQRT2;
  const path: { kind: 'line' | 'arc'; points: Vec[] }[] = [
    { kind: 'line', points: [wireStart, [turnX, gpioCenter[1], gpioCenter[2]]] },
    {
      kind: 'arc',
      points: [[turnX, gpioCenter[1], gpioCenter[2]], middleYZ, [turnX, passage.y, passage.z]],
    },
    {
      kind: 'line',
      points: [
        [turnX, passage.y, passage.z],
        [crossX - bend, passage.y, passage.z],
      ],
    },
    {
      kind: 'arc',
      points: [
        [crossX - bend, passage.y, passage.z],
        [crossX - bend + diagonal, passage.y, passage.z - bend + diagonal],
        [crossX, passage.y, passage.z - bend],
      ],
    },
    {
      kind: 'line',
      points: [
        [crossX, passage.y, passage.z - bend],
        [crossX, passage.y, lowZ + bend],
      ],
    },
    {
      kind: 'arc',
      points: [
        [crossX, passage.y, lowZ + bend],
        [crossX, passage.y - bend + diagonal, lowZ + bend - diagonal],
        [crossX, passage.y - bend, lowZ],
      ],
    },
    {
      kind: 'line',
      points: [
        [crossX, passage.y - bend, lowZ],
        [crossX, socket[1] + bend, lowZ],
      ],
    },
    {
      kind: 'arc',
      points: [
        [crossX, socket[1] + bend, lowZ],
        [crossX - bend + diagonal, socket[1] + bend - diagonal, lowZ],
        [crossX - bend, socket[1], lowZ],
      ],
    },
    {
      kind: 'line',
      points: [
        [crossX - bend, socket[1], socket[2]],
        [outputFarX - 0.2, socket[1], socket[2]],
      ],
    },
  ];
  const vector = (v: Vec) => 'App.Vector(' + v.join(',') + ')';
  const edgeCode = path.map((segment) =>
    segment.kind === 'line'
      ? 'Part.makeLine(' + segment.points.map(vector).join(',') + ')'
      : 'Part.Arc(' + segment.points.map(vector).join(',') + ').toShape()',
  );
  const powerCode = [
    'wire_edges = [' + edgeCode.join(',') + ']',
    'wire_path = Part.Wire(wire_edges)',
    'wire_profile = Part.Wire([Part.makeCircle(' +
      wireRadius +
      ',' +
      vector(wireStart) +
      ',wire_edges[0].tangentAt(wire_edges[0].FirstParameter))])',
    'wire_solid = wire_path.makePipeShell([wire_profile],True,False)',
    'gpio_space = ' + pythonShape(guidedGpioReserve()),
    'output_plug_space = Part.makeBox(9,8,6,' +
      vector([socket[0], socket[1] - 4, socket[2] - 3]) +
      ')',
    'shape = gpio_space.fuse(wire_solid).fuse(output_plug_space)',
  ].join('\n');

  return { gpioPins, passage, socket, path, powerCode, gpioCenter, wireStart, turnX, middleYZ };
}

/** A true toroidal open channel leaves approximately2.48mm of the3.5mm back plate. */
export function guidedPowerFrameClearance(p: Parameters): Shape {
  const q = guidedPowerPlan(p),
    { gpioCenter, passage, turnX } = q;
  const major = Math.hypot(passage.y - gpioCenter[1], passage.z - gpioCenter[2]) / 2;
  const angle = (Math.atan2(passage.z - gpioCenter[2], passage.y - gpioCenter[1]) * 180) / Math.PI;
  const torus: Shape = at(
    {
      kind: 'revolve',
      segments: 96,
      profile: Array.from({ length: 73 }, (_, i) => {
        const t = (i * Math.PI) / 36;
        return [major + 2.2 * Math.cos(t), 2.2 * Math.sin(t)] as [number, number];
      }),
    },
    {
      translation: [turnX, (passage.y + gpioCenter[1]) / 2, (passage.z + gpioCenter[2]) / 2],
      rotation: [angle, 0, 0],
    },
  );
  return union(
    { kind: 'intersect', children: [torus, box([100 + turnX, 100, 100], [-100, -50, -20])] },
    cylinder(2.2, 0.4, [turnX, gpioCenter[1], gpioCenter[2]], 'x'),
    cylinder(2.2, 55, [turnX, passage.y, passage.z], 'x'),
  );
}

/** Open-ended upper-corner passage avoids trapping the loose lead under the cell restraint. */
export function guidedPowerCoverClearance(p: Parameters): Shape {
  const q = guidedPowerPlan(p);
  return cylinder(2.2, 27, [q.socket[0] + 14, q.passage.y, -3]);
}
