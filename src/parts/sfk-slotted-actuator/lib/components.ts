import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
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
import neutralOccurrences from './neutral-occurrences.json';

export type Vec = [number, number, number];
export const libraries: readonly PartDefinition[] = [
  motor,
  screw,
  bearing,
  coupling,
  circlip,
  bolt,
  nut,
  washer,
  detail,
];
/** The original supplied M6 journal is a nominal envelope in both detail modes. */
export const nominalJournalNut = (piece: ConfiguredPiece) =>
  piece.component.id.startsWith('fixed-locknut-');

/** Fixed screw-axis motion law of the separately preserved slotted-crank design. */
export function layout(p: Parameters, state = 'assembled') {
  const angle =
    state === 'negative-limit' ? -20 : state === 'positive-limit' ? 20 : Number(p.outputAngle);
  const radians = (angle * Math.PI) / 180;
  const displacement = 12.2 * Math.tan(radians);
  const turns = displacement / 2.5;
  const rotation = ((((turns * 360 + 180) % 360) + 360) % 360) - 180;
  return {
    angle,
    displacement,
    center: 14.5 + displacement,
    turns,
    rotation,
    physicalRotation: rotation ? -rotation : 0,
    nutPosition: 50 + ((displacement - (rotation * 2.5) / 360) / 22) * 100,
    stroke: 2 * 12.2 * Math.tan(Math.PI / 9),
    pivot: [14.5, 0, 15.8] as Vec,
    pin: [14.5 + displacement, 17.5, 28] as Vec,
    rollerRadius: 12.2 / Math.cos(radians),
  };
}

const frame = (translation: Vec, rotation: Vec) =>
  new Matrix4()
    .makeTranslation(...translation)
    .multiply(
      new Matrix4().makeRotationFromEuler(
        new Euler(...(rotation.map((angle) => (angle * Math.PI) / 180) as Vec), 'ZYX'),
      ),
    );

function move(piece: ConfiguredPiece, motion: Matrix4): ConfiguredPiece {
  const placed = motion.multiply(
    frame(piece.component.placement.translation, piece.component.placement.rotation),
  );
  const rotation = new Euler().setFromRotationMatrix(placed, 'ZYX');
  piece.component.placement = {
    translation: new Vector3().setFromMatrixPosition(placed).toArray() as Vec,
    rotation: [rotation.x, rotation.y, rotation.z].map((angle) => (angle * 180) / Math.PI) as Vec,
  };
  return piece;
}

const aboutAxis = (point: Vec, axis: 'x' | 'y', degrees: number) =>
  new Matrix4()
    .makeTranslation(...point)
    .multiply(
      axis === 'x'
        ? new Matrix4().makeRotationX((degrees * Math.PI) / 180)
        : new Matrix4().makeRotationY((degrees * Math.PI) / 180),
    )
    .multiply(new Matrix4().makeTranslation(-point[0], -point[1], -point[2]));

const nutSlide = (id: string) =>
  id === 'nut-yoke' || id.startsWith('yoke-') || id.startsWith('nut-flange-');
const outputTurn = (id: string) =>
  id === 'output-shaft' ||
  id.startsWith('output-circlip-') ||
  /^output-(front|rear)-(crank|clamp-)/.test(id);
const screwTurn = (id: string) =>
  id === 'coupling' || id === 'support-circlip' || id.startsWith('fixed-locknut-');

/**
 * These neutral recipes and procurement records are the previous release's
 * canonical 76 occurrences. Pose changes are rigid placements; geometry stays
 * owned by this package and its explicitly declared supplier dependencies.
 */
export function actuatorPieces(p: Parameters, state = 'assembled'): ConfiguredPiece[] {
  const v = layout(p, state);
  const pieces = structuredClone(neutralOccurrences) as unknown as ConfiguredPiece[];
  for (const piece of pieces) {
    const item = piece.component;
    if (item.id === 'gearmotor') {
      const preset = motor.presets.find((candidate) => candidate.id === p.motorModel);
      if (!preset) throw new Error('Choose a supported gearmotor.');
      item.parameters = {
        ...item.parameters,
        model: p.motorModel,
        outputAngle: v.physicalRotation,
      };
      item.presetId = preset.id;
      if (preset.catalog)
        item.procurement = {
          designation: preset.catalog.designation,
          manufacturer: preset.catalog.manufacturer ?? preset.catalog.sourceName,
          source: preset.catalog.sourceUrl,
          ...(preset.catalog.standard ? { standard: preset.catalog.standard } : {}),
        };
    } else if (item.id === 'ball-screw') {
      item.parameters = { ...item.parameters, nutPosition: v.nutPosition, rotation: v.rotation };
    } else if (nutSlide(item.id)) {
      if (v.displacement) move(piece, new Matrix4().makeTranslation(v.displacement, 0, 0));
    } else if (outputTurn(item.id)) {
      if (v.angle) move(piece, aboutAxis(v.pivot, 'y', v.angle));
    } else if (screwTurn(item.id)) {
      if (v.physicalRotation) move(piece, aboutAxis([0, 0, 28], 'x', v.physicalRotation));
    }
  }
  return pieces;
}
