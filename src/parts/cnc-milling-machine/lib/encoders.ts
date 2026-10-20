import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import encoder, { encoderSpec, encoderParameters } from '../../cnc-linear-encoder/part';
import type { FrameHole, FrameReadheadEar } from '../../cnc-frame-part/part';
import type { MillingPiece, Motion } from './composition';
import type { WorkSurfaceCallbacks } from './work-surface';
import type { millingLayout } from './layout';
import { addFrameTap } from './mounting';

export const encoderLibraries = [encoder];
export const linearEncoderRequirements = [
  'Each LS 477 housing/readhead pair is one purchased kit; its matching MSL 41 spar is a separate order. Included inspection children must not create duplicate procurement units.',
  'The exact +/-3 um execution and TTL interpolation require an authentic delivered certificate, signal-mapped cable, CN5 electronic gearing, reference capture and a full-travel tool-position laser map.',
  'MSL recessed screw-seat contours and depths are nominal installation envelopes, not verified factory fit. Obtain current mounting instructions and approve the actual screw/clamp seating before release.',
  'Readhead adapters have a genuine integral 1.8 mm front ear: nominal spar clearance 0.5 mm, leaving 0.1 mm under a disclosed +/-0.2 mm mating-plane plus +/-0.2 mm spar-depth stack. The 6 mm M4 tap remains complete, with depth-dependent rear/front upper stock of 0.45/1.65 mm at the configured 0.05 mm radial allowance. Release preload, actual delivered contours and cable-load strength before manufacture.',
  'Protect the downward-facing sealing lips from chips/coolant, mount on a clean continuous machined datum and commission all cable bends, scale alarms and following-error shutdown.',
  'The X spar seats on a separate 12 mm steel backing plate. Only its lower 32.5 mm bears on the flat beam wall; qualify the upper cantilever, four M8 joints, flatness and thermal behavior before release.',
];
type Layout = ReturnType<typeof millingLayout>;
export interface LinearEncoderStation {
  axis: 'x' | 'y' | 'z';
  model: string;
  sparModel: string;
  origin: Vec;
  rotation: Vec;
  scaleMotion: Motion;
  headMotion: Motion;
  scaleHost: string;
  adapterHost: string;
  adapterSize: Vec;
  adapterOrigin: Vec;
  adapterRotation: Vec;
  adapterWall: number;
  adapterRole: 'limit-angle' | 'encoder-offset-angle';
  adapterExtra: Parameters;
  adapterGrip: number;
  adapterBoltLength: number;
  adapterSeats: Vec[];
  adapterNormal: Vec;
}
export const linearReadheadEar = {
  thickness: 1.8,
  bottomZ: -2.5,
  topZ: -0.3,
  width: 100,
  matingPlaneTolerance: 0.2,
  sparDepthTolerance: 0.2,
} as const;
const rotation = (r: Vec) =>
  new Euler(...(r.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX');
function direction(value: Vec, r: Vec): Vec {
  return new Vector3(...value).applyEuler(rotation(r)).toArray() as Vec;
}
function installed(value: Vec, station: Pick<LinearEncoderStation, 'origin' | 'rotation'>): Vec {
  return new Vector3(...value)
    .applyEuler(rotation(station.rotation))
    .add(new Vector3(...station.origin))
    .toArray() as Vec;
}
/** Convert the authored integral ear from supplier datums into the existing angle's local stock. */
export function linearEncoderEar(station: LinearEncoderStation): FrameReadheadEar {
  const spec = encoderSpec(station.model),
    middle = (spec.readheadMounts[0].position[0] + spec.readheadMounts[1].position[0]) / 2,
    inverse = new Matrix4().makeRotationFromEuler(rotation(station.adapterRotation)).invert(),
    corners = [-1, 1].flatMap((x) =>
      [0, 1].flatMap((y) =>
        [linearReadheadEar.bottomZ, linearReadheadEar.topZ].map((z) =>
          new Vector3(
            ...installed(
              [
                middle + (x * linearReadheadEar.width) / 2,
                spec.readheadRearY - (1 - y) * linearReadheadEar.thickness,
                z,
              ],
              station,
            ),
          )
            .sub(new Vector3(...station.adapterOrigin))
            .applyMatrix4(inverse),
        ),
      ),
    ),
    origin = [0, 1, 2].map((i) =>
      Math.min(...corners.map((point) => point.getComponent(i))),
    ) as Vec,
    max = [0, 1, 2].map((i) => Math.max(...corners.map((point) => point.getComponent(i)))) as Vec;
  return {
    origin: origin.map((n) => Number(n.toFixed(9))) as Vec,
    size: max.map((n, i) => Number((n - origin[i]).toFixed(9))) as Vec,
  };
}
/** Exact authored datums at the machine's canonical middle pose; subsequent motion is external. */
export function linearEncoderStations(_p: Parameters, v: Layout): LinearEncoderStation[] {
  const bedOuter = v.railSpacingY / 2 + v.bedWidth / 2,
    yOrigin: Vec = [bedOuter + 10.25, 0, v.bedTop - 80],
    yBottom = v.bedTop - 78.5,
    yHeight = v.gantryFootBottom - yBottom,
    // A real backing plate supports the complete spar while the source housing clears the nut bracket.
    xOrigin: Vec = [0, -v.beamDepth / 2 - 22.25, v.beamCenter + 78],
    zOrigin: Vec = [-135, v.xPlateFront + 10.25, v.guideLow + 100],
    zAdapterLeft = zOrigin[0] + 1.5,
    zHostFace = -v.movingPlateWidth / 2,
    zGrip = zHostFace - zAdapterLeft,
    zBoltLength = Math.floor((zGrip + 13) / 5) * 5;
  if (zBoltLength - zGrip < 5 || zBoltLength - zGrip > 13)
    throw new Error(
      'The Z encoder adapter needs at least 5 mm host engagement and 1 mm tap-tip reserve with an actual standard-length bolt.',
    );
  return [
    {
      axis: 'y',
      model: 'ls477-605363-30',
      sparModel: 'msl41-770902-24',
      origin: yOrigin,
      rotation: [180, 0, 90],
      scaleMotion: 'fixed',
      headMotion: 'gantry',
      scaleHost: 'fixed-bed-side-1',
      adapterHost: 'gantry-foot-1',
      adapterSize: [yHeight, 50, 100],
      adapterOrigin: [bedOuter + 1, -12.5, (yBottom + v.gantryFootBottom) / 2],
      adapterRotation: [90, -90, 0],
      adapterWall: 8,
      adapterRole: 'encoder-offset-angle',
      adapterExtra: { shoulderWidth: 16, rearWebHeight: 14.5 },
      adapterGrip: 8,
      adapterBoltLength: 20,
      adapterSeats: [-47.5, 22.5].map((y) => [bedOuter - 10, y, v.gantryFootBottom - 8] as Vec),
      adapterNormal: [0, 0, -1],
    },
    {
      axis: 'x',
      model: 'ls477-605365-86',
      sparModel: 'msl41-770902-17',
      origin: xOrigin,
      rotation: [180, 0, 0],
      scaleMotion: 'gantry',
      headMotion: 'x',
      scaleHost: 'x-linear-backing-plate',
      adapterHost: 'x-saddle-bridge-1',
      adapterSize: [30.5, 86, 100],
      adapterOrigin: [-12.5, -157, v.beamCenter + 94.75],
      adapterRotation: [180, -90, 0],
      adapterWall: 8,
      adapterRole: 'limit-angle',
      adapterExtra: {},
      adapterGrip: 8,
      adapterBoltLength: 20,
      adapterSeats: [-47.5, 22.5].map((x) => [x, -145, v.beamCenter + 102] as Vec),
      adapterNormal: [0, 0, -1],
    },
    {
      axis: 'z',
      model: 'ls477-605363-27',
      sparModel: 'msl41-770902-05',
      origin: zOrigin,
      rotation: [0, -90, 0],
      scaleMotion: 'x',
      headMotion: 'z',
      scaleHost: 'x-z-fixed-saddle',
      adapterHost: 'moving-z-saddle',
      adapterSize: [83.5, 68, zGrip],
      adapterOrigin: [(zAdapterLeft + zHostFace) / 2, v.zPlateBack + 6, zOrigin[2] - 22.25],
      adapterRotation: [0, 90, 0],
      adapterWall: 8,
      adapterRole: 'limit-angle',
      adapterExtra: {},
      adapterGrip: zGrip,
      adapterBoltLength: zBoltLength,
      adapterSeats: [7, 23].map((y) => [zAdapterLeft, v.zPlateBack + y, zOrigin[2] - 60] as Vec),
      adapterNormal: [-1, 0, 0],
    },
  ];
}

/** Place a real clearance drilling in a rotated authored bracket; taps use shared addFrameTap. */
function adapterClearance(station: LinearEncoderStation, seat: Vec): FrameHole {
  const inverse = new Matrix4().makeRotationFromEuler(rotation(station.adapterRotation)).invert(),
    normal = new Vector3(...station.adapterNormal),
    shaft = normal.clone().negate().transformDirection(inverse),
    depth = station.adapterGrip + 0.2,
    at = new Vector3(...seat)
      .addScaledVector(normal, 0.1)
      .sub(new Vector3(...station.adapterOrigin))
      .applyMatrix4(inverse),
    index = [0, 1, 2].find((i) => Math.abs(shaft.getComponent(i)) > 0.999999);
  if (index === undefined) throw new Error('Encoder adapter drilling must use a principal axis.');
  if (shaft.getComponent(index) < 0) at.addScaledVector(shaft, depth);
  return {
    axis: ['x', 'y', 'z'][index] as FrameHole['axis'],
    at: at.toArray() as Vec,
    diameter: 5.6,
    depth,
  };
}

/** Install three moving-head kits, separate spars and all twelve adapter plus eight spar screws. */
export function addLinearEncoders(
  p: Parameters,
  v: Layout,
  h: WorkSurfaceCallbacks,
  out: MillingPiece[],
) {
  for (const station of linearEncoderStations(p, v)) {
    const spec = encoderSpec(station.model),
      prefix = station.axis + '-linear',
      normal = direction([0, 1, 0], station.rotation);
    if (station.axis === 'x') {
      const at: Vec = [0, -v.beamDepth / 2 - 6, v.beamCenter + 60],
        halfSpar = spec.sparLength / 2,
        positions = [-halfSpar - 30, -halfSpar - 15, halfSpar + 15, halfSpar + 30],
        holes: FrameHole[] = positions.map((x) => ({
          axis: 'y',
          at: [x, -6.1, -10],
          diameter: 8.8,
          depth: 12.2,
        }));
      h.fabricated(
        'x-linear-backing-plate',
        'sensor-bracket',
        [spec.sparLength + 80, 12, 60],
        at,
        holes,
        'gantry',
        'steel',
        { stockGrade: 'Machined steel plate, exact grade pending engineering release' },
        [0, 0, 0],
        'equipment',
      );
      for (const [i, x] of positions.entries()) {
        const seat: Vec = [x, -v.beamDepth / 2 - 12, v.beamCenter + 50];
        h.fastener(
          'x-linear-backing-bolt-' + (i + 1),
          8,
          20,
          seat,
          [0, -1, 0],
          'gantry',
          'equipment',
        );
        addFrameTap(out, 'gantry-box-beam', seat, [0, -1, 0], 12, 8, 1.25, 10);
      }
    }
    for (const role of ['scale', 'readhead'] as const) {
      h.add(
        prefix + '-' + role,
        encoder,
        encoderParameters(station.model, role),
        'default',
        station.origin,
        station.rotation,
        role === 'scale' ? station.scaleMotion : station.headMotion,
        'equipment',
        role === 'scale' ? 0xbcc5cb : 0x3e454b,
        station.model,
      );
      out[out.length - 1].component.name =
        spec.designation + ' / supplied ' + (role === 'scale' ? 'scale housing' : 'readhead');
      out[out.length - 1].label = out[out.length - 1].component.name!;
    }
    h.add(
      prefix + '-spar',
      encoder,
      encoderParameters(station.sparModel),
      'default',
      station.origin,
      station.rotation,
      station.scaleMotion,
      'equipment',
      0xb9c5cb,
      station.sparModel,
    );
    for (const [i, hole] of spec.sparMounts.entries()) {
      const seat = installed([hole.position[0], hole.seatY!, hole.position[2]], station),
        grip = hole.seatY! - spec.sparBackY;
      h.fastener(
        prefix + '-spar-bolt-' + (i + 1),
        6,
        10,
        seat,
        normal,
        station.scaleMotion,
        'equipment',
      );
      addFrameTap(out, station.scaleHost, seat, normal, grip, 6, 1, 10);
    }
    const adapterId = prefix + '-readhead-adapter';
    h.fabricated(
      adapterId,
      station.adapterRole,
      station.adapterSize,
      station.adapterOrigin,
      station.adapterSeats.map((seat) => adapterClearance(station, seat)),
      station.headMotion,
      'steel',
      {
        wall: station.adapterWall,
        ...station.adapterExtra,
        readheadEar: JSON.stringify(linearEncoderEar(station)),
        stockGrade: 'Steel plate / milled angle, exact grade pending engineering release',
      },
      station.adapterRotation,
      'equipment',
    );
    for (const [i, seat] of station.adapterSeats.entries()) {
      h.fastener(
        prefix + '-adapter-host-bolt-' + (i + 1),
        5,
        station.adapterBoltLength,
        seat,
        station.adapterNormal,
        station.headMotion,
        'equipment',
      );
      addFrameTap(
        out,
        station.adapterHost,
        seat,
        station.adapterNormal,
        station.adapterGrip,
        5,
        0.8,
        14,
      );
    }
    for (const [i, hole] of spec.readheadMounts.entries()) {
      const seat = installed([hole.position[0], 15.25, hole.position[2]], station);
      h.fastener(
        prefix + '-readhead-bolt-' + (i + 1),
        4,
        20,
        seat,
        normal,
        station.headMotion,
        'equipment',
      );
      addFrameTap(out, adapterId, seat, normal, 15.25 - spec.readheadRearY, 4, 0.7, 6);
    }
    const adapter = out.find((piece) => piece.component.id === adapterId)!;
    if (station.axis === 'x')
      out
        .find((piece) => piece.component.id === 'x-linear-backing-plate')!
        .component.manufacturing!.requirements.push(
          'Machine the complete spar seat on the backing plate; the source beam supports only its lower 32.5 mm on the flat rear band.',
          'Qualify the 27.5 mm projection above the flat beam band, four M8 bolted joints, assembled flatness, thermal movement and measurement alignment.',
        );
    adapter.component.manufacturing!.requirements.push(
      'Readhead interface envelopes only: obtain delivered LS 477/MSL 41 mounting instructions and approve actual counterbore seating before release.',
      'The integral 1.8 mm front ear has 0.5 mm nominal spar clearance (0.1 mm after the stated +/-0.2 plus +/-0.2 mm dimensional stack) and remains 0.3 mm below the illustrative supplier clamp envelope throughout travel.',
      'Preserve the complete 6 mm M4 tapped cylinder. Upper edge ligament is depth-dependent: 0.45 mm in the rear 4.2 mm and 1.65 mm in the front 1.8 mm at the configured 0.05 mm radial allowance. Release the stepped section, preload and cable/vibration loads; these dimensions are not a strength approval.',
      'Machine the assembled readhead datum and qualify alignment through complete axis travel; CAD collision clearance is not positioning acceptance.',
      'Specify internal corner radius, actual steel grade, tool access and protective finish before machining the authored angle blank.',
    );
  }
}
