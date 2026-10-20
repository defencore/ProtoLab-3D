import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import measurement from '../../cnc-limit-sensor/part';
import type { FrameHole } from '../../cnc-frame-part/part';
import type { MillingPiece, Motion } from './composition';
import type { WorkSurfaceCallbacks } from './work-surface';
import type { millingLayout } from './layout';
import { addFrameTap } from './mounting';

export const limitLibraries = [measurement];
export const limitSource = 'https://www.ia.omron.com/data_pdf/cat/e2b_d116-e1_1_6_csm1012652.pdf';
export const limitRequirements = [
  'Six OMRON E2B-M12KS04-WP-B1 2M PNP NO sensors provide ordinary motion limits; they are not a safety function.',
  'The authored steel flags pass the sensing faces at 2 mm. Commission the switching point, hysteresis and stopping distance; fit independent mechanical stops and the validated emergency circuit.',
  'The supplier sensor remains one purchased unit including its two nuts. The existing nominal body and nut inspection envelopes do not certify thread span, internal construction or delivered mounting clearance.',
  'Route and protect all six 2 m cables, reserve bend radius, and check the manufacturer surrounding-metal and interference clearances before release.',
];
type Layout = ReturnType<typeof millingLayout>;
export interface LimitStation {
  id: string;
  axis: 'x' | 'y' | 'z';
  end: 'min' | 'max';
  gap: number;
  sensorOrigin: Vec;
  sensorRotation: Vec;
  sensorAxis: Vec;
  sensorMotion: Motion;
  targetCenter: Vec;
  targetSize: Vec;
  targetMotion: Motion;
  host: string;
  targetHost: string;
  bracketSize: Vec;
  bracketCenter: Vec;
  bracketRotation: Vec;
  bracketRole: 'limit-bridge' | 'limit-angle';
  rearWebHeight: number;
  bracketHoles: FrameHole[];
  bracketBoltSeats: Vec[];
  bracketBoltNormal: Vec;
  targetHoles: FrameHole[];
  targetBoltSeats: Vec[];
  targetBoltNormal: Vec;
}
const clearance = (axis: FrameHole['axis'], at: Vec, depth: number): FrameHole => ({
  axis,
  at,
  diameter: 4.6,
  depth,
});
/** All coordinates are the installed 50% pose; moving flags share the actual axis motion. */
export function limitStations(_p: Parameters, v: Layout): LimitStation[] {
  return (['min', 'max'] as const).flatMap((end) => {
    const sign = end === 'min' ? -1 : 1;
    const bedOuterX = v.railSpacingY / 2 + v.bedWidth / 2,
      footOuterX = v.footPlateCenterX + v.footPlateWidth / 2,
      yBridgeOuterX = footOuterX + 32.5,
      yBridgeSpan = yBridgeOuterX - bedOuterX,
      yBridgeCenterX = (yBridgeOuterX + bedOuterX) / 2;
    const yFlag = sign * (v.footPlateDepth / 2 - 15),
      y = yFlag + sign * 750,
      yHeight = v.gantryFootBottom + 15;
    const x = sign * 520,
      xFlag = sign * 100;
    // The connecting foot passes below the cheek, never through its swept plate.
    const yBracketBottom = v.tiebarCenter - 50,
      yBracketTop = yHeight + 17.5,
      yBracketHeight = yBracketTop - yBracketBottom,
      yBracketCenter = (yBracketTop + yBracketBottom) / 2;
    // Gauge-length-independent flags avoid the moving encoder bracket at both Z limits.
    const zFlag = end === 'min' ? v.guideLow + 20 : v.movingPlateTop - 20;
    const z = zFlag + (end === 'min' ? -100 : 100);
    const zSide = v.movingRibCenterX + v.movingRibThickness / 2;
    const zSensorY = v.zPlateFront + 30;
    const zBracketDepth = zSensorY + 20 - v.xPlateFront;
    const zBracketY = (v.xPlateFront + zSensorY + 20) / 2;
    return [
      {
        id: 'y-limit-' + end,
        axis: 'y',
        end,
        gap: 2,
        sensorOrigin: [footOuterX + 54.5, y, yHeight],
        sensorRotation: [0, -90, 0],
        sensorAxis: [-1, 0, 0],
        sensorMotion: 'fixed',
        targetCenter: [footOuterX + 2.5, yFlag, yHeight],
        targetSize: [5, 30, 25],
        targetMotion: 'gantry',
        host: 'fixed-bed-side-1',
        targetHost: 'gantry-foot-1',
        bracketSize: [40, yBridgeSpan, yBracketHeight],
        bracketCenter: [yBridgeCenterX, y, yBracketCenter],
        bracketRotation: [0, 0, -90],
        bracketRole: 'limit-bridge',
        rearWebHeight: v.bedTop + 10 - yBracketBottom,
        bracketHoles: [
          {
            axis: 'y',
            at: [0, yBridgeSpan / 2 - 5.1, yHeight - yBracketCenter],
            diameter: 12.5,
            depth: 5.2,
          },
          ...[-12, 12].map((a) =>
            clearance('y', [a, -yBridgeSpan / 2 - 0.1, v.bedTop - 40 - yBracketCenter], 5.2),
          ),
        ],
        bracketBoltSeats: [-12, 12].map((a) => [bedOuterX + 5, y - a, v.bedTop - 40] as Vec),
        bracketBoltNormal: [1, 0, 0],
        targetHoles: [-10, 10].map((a) => clearance('x', [-2.6, a, 0], 5.2)),
        targetBoltSeats: [-10, 10].map((a) => [footOuterX + 5, yFlag + a, yHeight] as Vec),
        targetBoltNormal: [1, 0, 0],
      },
      {
        id: 'x-limit-' + end,
        axis: 'x',
        end,
        gap: 2,
        sensorOrigin: [x, -274.5, v.beamCenter + 160],
        sensorRotation: [-90, 0, 0],
        sensorAxis: [0, 1, 0],
        sensorMotion: 'gantry',
        targetCenter: [xFlag, -222.5, v.beamCenter + 150],
        targetSize: [65, 5, 50],
        targetMotion: 'x',
        host: 'gantry-box-beam',
        targetHost: 'x-saddle-rear',
        bracketSize: [40, 217.5, 80],
        bracketCenter: [x, -143.75, v.beamCenter + 140],
        bracketRotation: [0, 0, 180],
        bracketRole: 'limit-bridge',
        rearWebHeight: 5,
        bracketHoles: [
          { axis: 'y', at: [0, 103.65, 20], diameter: 12.5, depth: 5.2 },
          ...[-12, 12].map((a) => clearance('z', [a, -103.75, -40.1], 5.2)),
        ],
        bracketBoltSeats: [-12, 12].map((a) => [x - a, -40, v.beamCenter + 105] as Vec),
        bracketBoltNormal: [0, 0, 1],
        targetHoles: [75, 85].map((a) => clearance('y', [sign * a - xFlag, -2.6, -20], 5.2)),
        targetBoltSeats: [75, 85].map((a) => [sign * a, -225, v.beamCenter + 130] as Vec),
        targetBoltNormal: [0, -1, 0],
      },
      {
        id: 'z-limit-' + end,
        axis: 'z',
        end,
        gap: 2,
        sensorOrigin: [zSide + 53.5, zSensorY, z],
        sensorRotation: [0, -90, 0],
        sensorAxis: [-1, 0, 0],
        sensorMotion: 'x',
        targetCenter: [zSide + 2, zSensorY, zFlag],
        targetSize: [4, 20, 30],
        targetMotion: 'z',
        host: 'x-z-fixed-saddle',
        targetHost: 'moving-z-saddle',
        bracketSize: [31.5, zBracketDepth, 40],
        bracketCenter: [zSide + 42.25, zBracketY, z],
        bracketRotation: [0, 180, 0],
        bracketRole: 'limit-angle',
        rearWebHeight: 0,
        bracketHoles: [
          { axis: 'x', at: [10.65, zSensorY - zBracketY, 0], diameter: 12.5, depth: 5.2 },
          ...[-12, 12].map((a) => clearance('y', [-10.75, -zBracketDepth / 2 - 0.1, a], 5.2)),
        ],
        bracketBoltSeats: [-12, 12].map((a) => [zSide + 53, v.xPlateFront + 5, z + a] as Vec),
        bracketBoltNormal: [0, 1, 0],
        targetHoles: [-10, 10].map((a) => clearance('x', [-2.1, 0, a], 4.2)),
        targetBoltSeats: [-10, 10].map((a) => [zSide + 4, zSensorY, zFlag + a] as Vec),
        targetBoltNormal: [1, 0, 0],
      },
    ] as LimitStation[];
  });
}

/** Install six purchased sensors, six separate brackets, steel flags and every mounting screw. */
export function addLimits(p: Parameters, v: Layout, h: WorkSurfaceCallbacks, out: MillingPiece[]) {
  for (const station of limitStations(p, v)) {
    h.add(
      station.id + '-sensor',
      measurement,
      { ...measurement.defaults, model: 'e2b-m12' },
      'default',
      station.sensorOrigin,
      station.sensorRotation,
      station.sensorMotion,
      'equipment',
      0xa5afb9,
      'e2b-m12',
    );
    h.fabricated(
      station.id + '-bracket',
      station.bracketRole,
      station.bracketSize,
      station.bracketCenter,
      station.bracketHoles,
      station.sensorMotion,
      'aluminium',
      { wall: 5, rearWebHeight: station.rearWebHeight },
      station.bracketRotation,
    );
    for (const [i, seat] of station.bracketBoltSeats.entries()) {
      h.fastener(
        station.id + '-bracket-bolt-' + (i + 1),
        4,
        10,
        seat,
        station.bracketBoltNormal,
        station.sensorMotion,
      );
      addFrameTap(out, station.host, seat, station.bracketBoltNormal, 5, 4, 0.7, 6);
    }
    h.fabricated(
      station.id + '-target',
      'sensor-bracket',
      station.targetSize,
      station.targetCenter,
      station.targetHoles,
      station.targetMotion,
      'steel',
    );
    for (const [i, seat] of station.targetBoltSeats.entries()) {
      h.fastener(
        station.id + '-target-bolt-' + (i + 1),
        4,
        10,
        seat,
        station.targetBoltNormal,
        station.targetMotion,
      );
      addFrameTap(
        out,
        station.targetHost,
        seat,
        station.targetBoltNormal,
        station.axis === 'z' ? 4 : 5,
        4,
        0.7,
        station.axis === 'z' ? 7 : 6,
      );
    }
  }
}
