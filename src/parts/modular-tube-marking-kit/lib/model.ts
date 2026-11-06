import { Box3, Euler, Matrix4, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import { componentGeometry, type ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  roundedRect,
  subtract,
  union,
} from '../../../core/assembly/boundary/shapes';
import { disposeModel } from '../../../core/mechanical';
import { fastenerValues } from '../../../core/hardware/fasteners';
import {
  resolveTubeProfile,
  validateTubeProfile,
} from '../../modular-tube-avionics/lib/tube-interface';
import manufactured from '../../manufactured-detail/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import {
  tubeReferenceDatums,
  accessWindowDatums,
  at,
  intersect,
  purchased,
} from '../../modular-tube-avionics/lib/shared';
import {
  jigDatums,
  jigPattern,
  jigPrinted,
  jigLayout,
  diagonalPoint,
  type PrintedTool,
} from './shapes';
export { jigPrinted, jigLayout, diagonalPoint, type PrintedTool } from './shapes';

export const libraries: PartDefinition[] = [manufactured, bolt, nut];
const pressurePreset = bolt.presets.find((v) => v.id === 'gvyntok-040-190-008')!;
const retainerPreset = bolt.presets.find((v) => v.id === 'gvyntok-040-190-009')!;
const pressureValues = fastenerValues(pressurePreset.parameters);
const retainerValues = fastenerValues(retainerPreset.parameters);
const radians = (n: number) => (n * Math.PI) / 180;

function tool(piece: PrintedTool): ConfiguredPiece {
  // A Boolean boundary keeps the localizing feature transform inside the recipe.
  // detailComponent otherwise interprets an outer transform as occurrence placement.
  const component = detailComponent(piece.id, piece.name, union(piece.shape), {
    nativeRefine: true,
    meshBackend: 'manifold',
  });
  component.placement = { translation: [...piece.placement], rotation: [0, 0, 0] };
  component.manufacturing = {
    material: 'PETG',
    blank: 'FDM print',
    processes: ['printing'],
    requirements: [
      'Print the exported flat face on the bed, with a brim as needed. Inspect the guide holes and every datum face before use.',
      'Marking only: no powered drill/router guide rating or hardened bushings. Remove the tools before final drilling, head-seat finishing and cutting.',
      'Use removable bands or tape at the documented broad lands to keep the saddle and lap datum faces seated. These process consumables are not selected procurement items.',
      'Check tube fit and a 100 mm rule against measured physical standards; nominal CAD does not establish printed marking accuracy.',
    ],
  };
  component.notes = `Standalone modular-tube-marking-kit / ${piece.id}. Local X recipe; explicit front-datum working placement. Fit controls do not resize the target pattern.`;
  return { component, label: piece.name, color: 0xd5a94b, requireSingleSolid: true };
}

export function jigPayload(p: Parameters): ConfiguredPiece[] {
  resolveTubeProfile(p);
  const d = jigDatums.clamp;
  return [
    purchased(
      bolt,
      'modular-tube-jig-pressure-screw',
      pressurePreset.id,
      diagonalPoint(
        d.pressureX,
        d.pressureHeadN - (pressureValues.shaftLength - pressureValues.total / 2),
        0,
      ),
      [-45, 0, 0],
      'default',
    ),
    purchased(
      nut,
      'modular-tube-jig-pressure-nut',
      'gvyntok-474adfbe1cd7',
      diagonalPoint(d.pressureX, d.nutInnerN, 0),
      [-45, 0, 0],
      'default',
    ),
    purchased(
      bolt,
      'modular-tube-jig-shoe-retainer-screw',
      retainerPreset.id,
      diagonalPoint(
        d.retainerHeadX + (retainerValues.shaftLength - retainerValues.total / 2),
        d.retainerN,
        d.retainerS,
      ),
      [0, -90, 0],
      'default',
    ),
    purchased(
      nut,
      'modular-tube-jig-shoe-retainer-nut',
      'gvyntok-474adfbe1cd7',
      diagonalPoint(d.retainerNutX, d.retainerN, d.retainerS),
      [0, 90, 0],
      'default',
    ),
  ];
}

export function jigReferences(p: Parameters): ConfiguredPiece[] {
  const t = { ...tubeReferenceDatums, ...resolveTubeProfile(p) },
    length = t.backX - t.frontX;
  const tube = subtract(
    cylinder(t.outerDiameter / 2, length, [0, 0, 0], 'x'),
    cylinder(t.innerDiameter / 2, length + 2, [-1, 0, 0], 'x'),
  );
  const cuts = union(
    ...jigPattern.holeStations.map((s) =>
      cylinder(jigPattern.finishedHoleDiameter / 2, 100, [s.x, -50, 0], 'y'),
    ),
    at(
      roundedRect(
        accessWindowDatums.length,
        accessWindowDatums.width,
        accessWindowDatums.cornerRadius,
        20,
        40,
      ),
      [jigPattern.windowCenterX, 0, 0],
    ),
    at(
      roundedRect(
        accessWindowDatums.length,
        accessWindowDatums.width,
        accessWindowDatums.cornerRadius,
        -60,
        40,
      ),
      [jigPattern.windowCenterX, 0, 0],
    ),
  );
  const skin = subtract(
    cylinder(t.outerDiameter / 2 + 0.12, length, [0, 0, 0], 'x'),
    cylinder(t.outerDiameter / 2 - 0.1, length + 2, [-1, 0, 0], 'x'),
  );
  return [
    {
      id: 'modular-tube-jig-workpiece-reference',
      name: `Uncut nominal D${t.outerDiameter}/${t.innerDiameter} tube · front X0`,
      shape: tube,
      color: 0x9ba3ab,
    },
    {
      id: 'modular-tube-jig-target-pattern-reference',
      name: 'Authoritative 2-window / 16-hole target pattern',
      shape: intersect(skin, cuts),
      color: 0xc84839,
    },
  ].map((item) => {
    const component = detailComponent(item.id, item.name, item.shape, {
      nativeRefine: true,
      meshBackend: 'manifold',
    });
    component.supply = 'reference';
    component.notes =
      'Unprocured workpiece/target reference only. Excluded from kit composition, native physical and manufacturing exports.';
    return { component, label: item.name, color: item.color };
  });
}

function rotatePass(piece: ConfiguredPiece, opposite: boolean): ConfiguredPiece {
  if (
    !opposite ||
    ![
      'modular-tube-jig-window-stencil',
      'modular-tube-jig-rail-front',
      'modular-tube-jig-rail-rear',
    ].includes(piece.component.id)
  )
    return piece;
  const p = piece.component.placement ?? { translation: [0, 0, 0], rotation: [0, 0, 0] };
  const before = new Matrix4().makeRotationFromEuler(
    new Euler(...((p.rotation ?? [0, 0, 0]).map(radians) as [number, number, number]), 'XYZ'),
  );
  const world = new Matrix4().makeRotationX(Math.PI).multiply(before);
  const e = new Euler().setFromRotationMatrix(world, 'XYZ');
  const v = new Vector3(...p.translation).applyAxisAngle(new Vector3(1, 0, 0), Math.PI);
  return {
    ...piece,
    component: {
      ...piece.component,
      placement: {
        translation: v.toArray() as [number, number, number],
        rotation: [e.x, e.y, e.z].map((x) => (x * 180) / Math.PI) as [number, number, number],
      },
    },
  };
}

function printLayout(p: Parameters): ConfiguredPiece[] {
  return jigPrinted(p).map((item, i) => {
    const piece = tool(item);
    piece.component.placement = { translation: [0, 0, 0], rotation: [...item.printRotation] };
    const g = componentGeometry(libraries, [piece]);
    try {
      const bb = new Box3().setFromObject(g, true);
      piece.component.placement.translation = [
        (i % 2) * 260 - bb.min.x,
        Math.floor(i / 2) * 260 - bb.min.y,
        -bb.min.z,
      ];
    } finally {
      disposeModel(g);
    }
    return piece;
  });
}

/** includeReferences=true is preview; false is physical native/export composition. */
export function configured(
  p: Parameters,
  state: string,
  includeReferences = true,
): ConfiguredPiece[] {
  if (state === 'print') return printLayout(p);
  let pieces = [...jigPrinted(p).map(tool), ...jigPayload(p)];
  if (state === 'exploded') {
    pieces = pieces.map((piece, i) => {
      const place = piece.component.placement ?? { translation: [0, 0, 0], rotation: [0, 0, 0] };
      const delta =
        i === 0
          ? [0, 30, 0]
          : i === 1
            ? [0, -30, 0]
            : i === 2
              ? [0, 0, 45]
              : i === 3
                ? [0, 45, 0]
                : i === 4
                  ? [35, 15, 0]
                  : [0, i % 2 ? -30 : 30, 0];
      return {
        ...piece,
        component: {
          ...piece.component,
          placement: {
            ...place,
            translation: place.translation.map((v, k) => v + delta[k]) as [number, number, number],
          },
        },
      };
    });
  }
  pieces = pieces.map((piece) => rotatePass(piece, p.side === 'opposite'));
  if (includeReferences && p.showTube) pieces.push(...jigReferences(p));
  return pieces;
}

/** Released clamp envelope without changing any component fabrication recipe. */
export function jigReleased(p: Parameters, travel = 1): ConfiguredPiece[] {
  const ids = new Set(['modular-tube-jig-clamp-shoe', 'modular-tube-jig-pressure-screw']);
  const delta = diagonalPoint(0, travel, 0);
  return configured(p, 'assembled', false).map((piece) => {
    if (!ids.has(piece.component.id)) return piece;
    const place = piece.component.placement!;
    return {
      ...piece,
      component: {
        ...piece.component,
        placement: {
          ...place,
          translation: place.translation.map((v, i) => v + delta[i]) as [number, number, number],
        },
      },
    };
  });
}

export function validateJig(p: Parameters): string[] {
  const failures: string[] = validateTubeProfile(p);
  if (Number(p.markDiameter) > 3.4 || Number(p.markDiameter) < 3.1)
    failures.push('Keep the transfer passage separate from the fixed 3.4 mm final hole.');
  if (Number(p.fitAllowance) < 0.1 || Number(p.fitAllowance) > 1)
    failures.push('Qualify a tube fitting allowance within the supported range.');
  if (Number(p.jointAllowance) < 0.1 || Number(p.jointAllowance) > 0.5)
    failures.push('Choose a supported printed register fitting allowance.');
  if (!['first', 'opposite'].includes(String(p.side)))
    failures.push('Choose the first or opposite tool-register pass.');
  return failures;
}
