import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  roundedRect,
  subtract,
  union,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import { fastenerValues } from '../../../core/hardware/fasteners';
import bolt from '../../bolt-screw/part';
import { wingMiniMounts } from '../../flight-controller/lib/wing-mini';
import wing from '../../flight-controller/part';
import { h7Spec, mountingHoles } from '../../lch7-controller/lib/model';
import nyloc from '../../nyloc-nut/part';
import washer from '../../washer/part';
import { at, purchased, type PrintedItem } from './shared';

export interface CassetteBoardPoses {
  wingY: number;
  wingZ: number;
  lchZ: number;
}

export const cassetteDatums = {
  deckBottom: -15.4,
  deckThickness: 3,
  padBottom: -17.4,
  sleeveOuterDiameter: 5,
  sleeveBore: 3.4,
  sleeveLength: 6,
  sleeveRadialClearance: 0.05,
  upperLipHeight: 1.2,
  eyeRadius: 5.4,
  eyeBore: 7.3,
  eyeLipRadius: 4.5,
  axes: [-23, 23].flatMap((x) => [-28.3, 28.3].map((y) => [x, y] as const)),
} as const;

const wingModel = wing.presets.find((preset) => preset.id === 'speedybee-f405-wing-mini')!;
const wingScrew = bolt.presets.find((preset) => preset.id === 'gvyntok-040-200-004')!;
const lchScrew = bolt.presets.find((preset) => preset.id === 'gvyntok-040-200-014')!;
const lchNutPreset = 'tr-tr00000407-000';
const lchWasher = washer.presets.find((preset) => preset.id === 'gvyntok-287d9cbfa54c')!;
const wingHeadBearing = -9.8;
const lchNutBearing = cassetteDatums.deckBottom;
const deckTop = cassetteDatums.deckBottom + cassetteDatums.deckThickness;

function boardMounts(p: CassetteBoardPoses) {
  const wingAxes = wingMiniMounts(wingModel.parameters).map(
    ([x, y]) => [-x, p.wingY - y] as [number, number],
  );
  return {
    wing: [wingAxes[3], wingAxes[0], wingAxes[1], wingAxes[2]],
    lch: [3, 0, 1, 2].map((index) => {
      const [x, y] = mountingHoles[index];
      return [-y, x] as const;
    }),
    lchPcbBottom: p.lchZ + h7Spec.rearDepth,
    lchPcbTop: p.lchZ + h7Spec.rearDepth + h7Spec.boardThickness,
  };
}

function nutSocket(x: number, y: number, acrossFlats: number, bottom: number, top: number): Shape {
  const radius = acrossFlats / Math.sqrt(3);
  return prism(
    Array.from({ length: 6 }, (_, i): [number, number] => {
      const angle = ((i + 0.5) * Math.PI) / 3;
      return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
    }),
    top - bottom,
    bottom,
  );
}

function boardCarrier(p: CassetteBoardPoses): Shape {
  const d = cassetteDatums;
  const mounts = boardMounts(p);
  const stock = union(
    box([54, 54, d.deckThickness], [-27, -27, d.deckBottom]),
    ...d.axes.map(([x, y]) => cylinder(d.eyeRadius, d.deckThickness, [x, y, d.deckBottom])),
    ...mounts.wing.map(([x, y]) =>
      at(
        {
          kind: 'revolve',
          profile: [
            [0, deckTop - 0.2],
            [3.6, deckTop - 0.2],
            [3.6, p.wingZ - 0.8],
            [2.8, p.wingZ],
            [0, p.wingZ],
          ],
        },
        [x, y, 0],
      ),
    ),
    ...mounts.lch.map(([x, y]) =>
      at(
        {
          kind: 'revolve',
          profile: [
            [0, mounts.lchPcbTop],
            [3, mounts.lchPcbTop],
            [3, d.deckBottom - 0.85],
            [4.2, d.deckBottom],
            [4.2, d.deckBottom + 0.2],
            [0, d.deckBottom + 0.2],
          ],
        },
        [x, y, 0],
      ),
    ),
    // Two diagonally opposed locators set the pose. The other holes only clamp.
    ...mounts.lch.slice(0, 2).map(([x, y]) => cylinder(1.95, 1.2, [x, y, mounts.lchPcbTop - 1])),
  );
  return subtract(
    stock,
    ...d.axes.map(([x, y]) =>
      cylinder(d.eyeBore / 2, d.deckThickness + 0.2, [x, y, d.deckBottom - 0.1]),
    ),
    ...mounts.wing.flatMap(([x, y]) => [
      cylinder(
        Number(wingScrew.parameters.headSize) / 2 + 0.15,
        wingHeadBearing - d.deckBottom + 0.2,
        [x, y, d.deckBottom - 0.2],
      ),
      cylinder(1.1, p.wingZ - wingHeadBearing + 0.2, [x, y, wingHeadBearing - 0.1]),
    ]),
    ...mounts.lch.flatMap(([x, y]) => [
      nutSocket(x, y, 5.25, lchNutBearing, deckTop + 0.2),
      cylinder(1.35, lchNutBearing - mounts.lchPcbTop + 1.2, [x, y, mounts.lchPcbTop - 1.1]),
    ]),
  );
}

function boardIsolator(): Shape {
  const d = cassetteDatums;
  const padThickness = d.deckBottom - d.padBottom;
  const baseRing = subtract(
    roundedRect(
      2 * (23 + d.eyeRadius),
      2 * (28.3 + d.eyeRadius),
      d.eyeRadius,
      d.padBottom,
      padThickness,
    ),
    box([45.4, 53.4, padThickness + 0.2], [-22.7, -26.7, d.padBottom - 0.1]),
  );
  const eyeNeck = d.eyeBore / 2;
  const lipRamp = d.eyeLipRadius - eyeNeck;
  const upperLip = deckTop + d.upperLipHeight;
  return subtract(
    union(
      baseRing,
      ...d.axes.map(([x, y]) =>
        at(
          {
            kind: 'revolve',
            profile: [
              [0, d.deckBottom - 0.2],
              [eyeNeck, d.deckBottom - 0.2],
              [eyeNeck, deckTop],
              [d.eyeLipRadius, deckTop + lipRamp],
              [d.eyeLipRadius, upperLip],
              [0, upperLip],
            ],
          },
          [x, y, 0],
        ),
      ),
    ),
    ...d.axes.map(([x, y]) =>
      cylinder(d.sleeveOuterDiameter / 2 + d.sleeveRadialClearance, upperLip - d.padBottom + 0.2, [
        x,
        y,
        d.padBottom - 0.1,
      ]),
    ),
  );
}

export function flightCassettePrinted(poses: CassetteBoardPoses): PrintedItem[] {
  return [
    {
      id: 'flight-board-carrier',
      name: 'Common rigid flight board carrier',
      shape: boardCarrier(poses),
      material: 'PETG',
      module: 'flight',
    },
    {
      id: 'flight-board-isolator',
      name: 'Common flight board TPU support',
      shape: boardIsolator(),
      material: 'TPU',
      module: 'flight',
    },
  ];
}

export function flightCassetteBoardHardware(poses: CassetteBoardPoses): ConfiguredPiece[] {
  const m = boardMounts(poses);
  const wingScrewValues = fastenerValues(wingScrew.parameters);
  const lchScrewValues = fastenerValues(lchScrew.parameters);
  const washerThickness = Number(lchWasher.parameters.thickness);
  return [
    ...m.wing.map(([x, y], i) =>
      purchased(
        bolt,
        `wing-mount-screw-${i + 1}`,
        wingScrew.id,
        [x, y, wingHeadBearing + (wingScrewValues.shaftLength - wingScrewValues.h) / 2],
        [180, 0, 0],
        'default',
      ),
    ),
    ...m.lch.flatMap(([x, y], i) => [
      purchased(
        bolt,
        `lch7-mount-screw-${i + 1}`,
        lchScrew.id,
        [
          x,
          y,
          m.lchPcbBottom - washerThickness + (lchScrewValues.shaftLength - lchScrewValues.h) / 2,
        ],
        [180, 0, 0],
        'default',
      ),
      purchased(
        washer,
        `lch7-mount-washer-${i + 1}`,
        lchWasher.id,
        [x, y, m.lchPcbBottom - washerThickness / 2],
        [0, 0, 0],
        'default',
      ),
      purchased(
        nyloc,
        `lch7-mount-nut-${i + 1}`,
        lchNutPreset,
        [x, y, lchNutBearing],
        [0, 0, 0],
        'default',
      ),
    ]),
  ];
}
