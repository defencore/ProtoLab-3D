import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import motor from '../../gmp16-gearmotor/part';
import screw from '../../ball-screw/part';
import bearing from '../../flanged-ball-bearing/part';
import coupling from '../../jaw-coupling/part';
import circlip from '../../retaining-ring/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import detail from '../../manufactured-detail/part';
import { outputLayout } from './output';

export type Vec = [number, number, number];
export interface Fastener {
  id: string;
  diameter: number;
  length: number;
  underHead: Vec;
  direction: Vec;
  head?: 'button' | 'socket-cap';
}
export const libraries = [motor, screw, bearing, coupling, circlip, bolt, nut, washer, detail];
/** The supplied screw end specifies a nominal M6 envelope, without physical thread flanks. */
export const nominalJournalNut = (piece: ConfiguredPiece) =>
  piece.component.id.startsWith('fixed-locknut-');
export const screwPreset = screw.presets.find((p) => p.id === 'kaiyade-sfk0825-100-end-machine')!;
const couplingPreset = coupling.presets.find((p) => p.id === 'lf-d14-l22-clamp-3-4')!;
const bearingPreset = bearing.presets.find((p) => p.id === 'f686-2rs')!;
const circlipPreset = circlip.presets.find((p) => p.id === 'gvyntok-556a65f14eb5')!;

export function layout(p: Parameters, state = 'assembled') {
  const angle =
    state === 'negative-limit' ? -20 : state === 'positive-limit' ? 20 : Number(p.outputAngle);
  const radians = (angle * Math.PI) / 180;
  const displacement = outputLayout.radius * Math.tan(radians);
  const pinRadius = outputLayout.radius / Math.cos(radians);
  const turns = displacement / 2.5;
  const rotation = ((((turns * 360 + 180) % 360) + 360) % 360) - 180;
  return {
    angle,
    displacement,
    center: 14.5 + displacement,
    turns,
    rotation,
    physicalRotation: ((((90 - rotation + 180) % 360) + 360) % 360) - 180,
    nutClocking: 90,
    nutPosition: 50 + ((displacement - (rotation * 2.5) / 360) / 22) * 100,
    stroke: 2 * outputLayout.radius * Math.tan(Math.PI / 9),
    pivot: outputLayout.pivot,
    pin: [outputLayout.pivot[0] + displacement, 11.55, 28] as Vec,
    pinRadius,
    forkRoot: outputLayout.slotRoot,
    forkTip: outputLayout.slotTip,
    crankRadius: outputLayout.radius,
  };
}
function euler(matrix: Matrix4): Vec {
  return new Euler()
    .setFromRotationMatrix(matrix, 'ZYX')
    .toArray()
    .slice(0, 3)
    .map((v) => (Number(v) * 180) / Math.PI) as Vec;
}
function axialRotation(phase = 0): Vec {
  return euler(
    new Matrix4()
      .makeRotationY(Math.PI / 2)
      .multiply(new Matrix4().makeRotationZ((phase * Math.PI) / 180)),
  );
}

export function configured(
  part: PartDefinition,
  id: string,
  label: string,
  parameters: Parameters,
  translation: Vec,
  rotation: Vec = [0, 0, 0],
  state = 'default',
  color = 0xaeb5be,
  presetId?: string,
): ConfiguredPiece {
  const catalogPreset =
    part.presets.find((p) => p.id === presetId) ??
    (part.id === 'gmp16-gearmotor'
      ? part.presets.find((p) => p.parameters.model === parameters.model)
      : undefined);
  const catalog = catalogPreset?.catalog;
  const component: AssemblyComponent = {
    id,
    libraryId: part.id,
    name: label,
    parameters,
    quantity: 1,
    state,
    supply: part.product.supply,
    placement: { translation, rotation },
    ...(catalogPreset ? { presetId: catalogPreset.id } : {}),
    ...(catalog
      ? {
          procurement: {
            designation: catalog.designation,
            manufacturer: catalog.manufacturer ?? catalog.sourceName,
            source: catalog.sourceUrl,
            ...(catalog.standard ? { standard: catalog.standard } : {}),
          },
        }
      : {}),
  };
  return {
    component,
    label,
    color,
    preserveLibraryAppearance: [
      'gmp16-gearmotor',
      'ball-screw',
      'flanged-ball-bearing',
      'jaw-coupling',
    ].includes(part.id),
  };
}
export function purchasedPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state);
  return [
    configured(
      motor,
      'gearmotor',
      'GMP16T-TEC1636 planetary gearmotor',
      { ...motor.defaults, model: p.motorModel, outputAngle: v.physicalRotation },
      [-70, 0, 28],
      [0, 90, 0],
      'assembled',
    ),
    configured(
      screw,
      'ball-screw',
      'SFK0825 · 100 mm ball screw and nut',
      { ...screwPreset.parameters, nutPosition: v.nutPosition, rotation: v.rotation },
      [0, 0, 28],
      axialRotation(90),
      'assembled',
      0x92a7b6,
      screwPreset.id,
    ),
    configured(
      coupling,
      'coupling',
      'LF D14 L22 flexible jaw coupling · Clamp 3×4',
      { ...couplingPreset.parameters },
      [-54.2, 0, 28],
      axialRotation(v.physicalRotation),
      'assembly',
      0xaeb5be,
      couplingPreset.id,
    ),
    ...[-14.5, 43.5].map((x, i) =>
      configured(
        bearing,
        'screw-bearing-' + i,
        `${i ? 'Floating' : 'Fixed'} flanged bearing · F686-2RS 6×13×5`,
        { ...bearingPreset.parameters },
        [x, 0, 28],
        [0, i ? 90 : -90, 0],
        'assembled',
        0xaeb5be,
        bearingPreset.id,
      ),
    ),
    ...outputLayout.bearingCenters.map((y, i) =>
      configured(
        bearing,
        'output-bearing-' + i,
        `${i ? 'Positive' : 'Negative'} output flanged bearing · F686-2RS 6×13×5`,
        { ...bearingPreset.parameters },
        [outputLayout.pivot[0], y, outputLayout.pivot[2]],
        [i ? -90 : 90, 0, 0],
        'assembled',
        0xaeb5be,
        bearingPreset.id,
      ),
    ),
    configured(
      circlip,
      'support-circlip',
      'Screw support retaining ring · DIN 471 Ø6',
      { ...circlipPreset.parameters, boreEnvelope: 5.7 },
      [48.2, 0, 28],
      axialRotation(v.physicalRotation),
      'default',
      0x333b45,
      circlipPreset.id,
    ),
    ...[-22.7, 22.7, -15.8, 15.8].map((y, i) =>
      configured(
        circlip,
        'output-circlip-' + i,
        `${y > 0 ? 'Positive' : 'Negative'} output ${i < 2 ? 'outer' : 'inner'} retaining ring · DIN 471 Ø6`,
        { ...circlipPreset.parameters, boreEnvelope: 5.7 },
        [outputLayout.pivot[0], y, outputLayout.pivot[2]],
        euler(
          new Matrix4()
            .makeRotationY((v.angle * Math.PI) / 180)
            .multiply(new Matrix4().makeRotationX(-Math.PI / 2)),
        ),
        'default',
        0x333b45,
        circlipPreset.id,
      ),
    ),
    ...[
      [-34.5, 5],
      [-38.5, 3],
    ].map(([x, height], i) =>
      configured(
        nut,
        'fixed-locknut-' + i,
        `Fixed journal ${i ? 'jam nut' : 'locknut'} · M6×0.75`,
        { ...nut.defaults, bore: 6, pitch: 0.75, acrossFlats: 10, height },
        [x - height / 2, 0, 28],
        axialRotation(v.physicalRotation),
        'default',
        0x637080,
      ),
    ),
  ];
}

/** The library bolt points from its tip toward the head along local +Z. */
export function fastenerPiece(spec: Fastener): ConfiguredPiece {
  const head = spec.head ?? 'socket-cap';
  const preset = bolt.presets.find(
    (p) =>
      p.parameters.diameter === spec.diameter &&
      p.parameters.length === spec.length &&
      p.parameters.head === head,
  );
  const d = spec.diameter;
  const familyPreset =
    preset ?? bolt.presets.find((p) => p.parameters.diameter === d && p.parameters.head === head);
  const parameters: Parameters = familyPreset
    ? { ...familyPreset.parameters, length: spec.length, threadLength: spec.length }
    : {
        ...bolt.defaults,
        diameter: d,
        shankDiameter: d,
        length: spec.length,
        head: 'socket-cap',
        headSize: d === 2 ? 3.8 : 5.5,
        headHeight: d,
        drive: 'hex',
        driveWidth: d === 2 ? 1.5 : 2.5,
        driveDepth: d * 0.42,
        pitch: d === 2 ? 0.4 : 0.5,
        threadLength: spec.length,
        tipLength: d * 0.1,
        tipDiameter: d * 0.6,
      };
  const direction = new Vector3(...spec.direction).normalize();
  const rotation = axisRotation(direction.clone().negate().toArray() as Vec);
  const translation = new Vector3(...spec.underHead)
    .addScaledVector(direction, (spec.length - Number(parameters.headHeight)) / 2)
    .toArray() as Vec;
  return configured(
    bolt,
    spec.id,
    `${spec.id} · M${d}×${spec.length}`,
    parameters,
    translation,
    rotation,
    'default',
    0x333b45,
    preset?.id,
  );
}

export function hexNutPiece(
  id: string,
  diameter: number,
  center: Vec,
  rotation: Vec = [0, 0, 0],
): ConfiguredPiece {
  const preset = nut.presets.find((p) => p.parameters.bore === diameter);
  if (!preset) throw new Error(`Missing a configured M${diameter} nut.`);
  const parameters = { ...preset.parameters };
  const offset = new Vector3(0, 0, Number(parameters.height) / 2).applyEuler(
    new Euler(...(rotation.map((v) => (v * Math.PI) / 180) as Vec), 'ZYX'),
  );
  const translation = new Vector3(...center).sub(offset).toArray() as Vec;
  return configured(
    nut,
    id,
    `${id} · M${diameter}`,
    parameters,
    translation,
    rotation,
    'default',
    0x637080,
    preset?.id,
  );
}

export function axisRotation(axis: Vec): Vec {
  const cardinal = new Vector3(...axis).normalize();
  if (cardinal.y === 0 && cardinal.z === 0) return [0, cardinal.x > 0 ? 90 : -90, 0];
  if (cardinal.x === 0 && cardinal.z === 0) return [cardinal.y > 0 ? -90 : 90, 0, 0];
  if (cardinal.x === 0 && cardinal.y === 0) return [0, cardinal.z > 0 ? 0 : 180, 0];
  return euler(
    new Matrix4().makeRotationFromQuaternion(
      new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...axis).normalize()),
    ),
  );
}
