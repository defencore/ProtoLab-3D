import { Box3, Mesh, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { componentGeometry, type ConfiguredPiece } from '../../../core/assembly/detail-instances';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import manufactured from '../../manufactured-detail/part';
import grandado from '../../catalog-enclosure/part';
import holder from '../../li-ion-battery-holder/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import washer from '../../washer/part';
import cell from '../../li-ion-cell/part';
import { layout, move, connectorReliefs, tubeCountersink, type PrintedPiece } from './spec';
import { jigPieces } from './jig';
import { cassettePieces } from './cassette';
import { endRetainerPieces, endRetainerHardware } from './end-retainer';
import { replacementLidFactoryScrews, replacementLidPieces, replacementLidSpec, replacementLidGasketReference } from './replacement-lid';
import { cableWireReference } from './cable-routing';

export const libraries: PartDefinition[] = [
  manufactured,
  grandado,
  holder,
  bolt,
  nut,
  washer,
  cell,
];
export const printedPieces = (p: Parameters) => [
  ...jigPieces(p),
  ...cassettePieces(p),
  ...endRetainerPieces(p),
  ...replacementLidPieces(p),
];
const hex = (af: number, z: number, depth: number, x = 0, y = 0): Shape =>
  prism(
    Array.from({ length: 6 }, (_, i) => {
      const a = ((i + 0.5) * Math.PI) / 3;
      return [x + (af / Math.sqrt(3)) * Math.cos(a), y + (af / Math.sqrt(3)) * Math.sin(a)] as [
        number,
        number,
      ];
    }),
    depth,
    z,
  );

export function fitCoupon(p: Parameters): PrintedPiece {
  const d = layout(p);
  const shape = subtract(
    union(box([50, 26, 3], [-25, -13, 0]), box([14, 16, 6], [5, -8, 2.8])),
    cylinder(d.mountHole / 2, 10, [-15, 0, -1]),
    hex(d.nutAF, 2.5, d.nutHeight, 12),
    box([14, (2 * d.nutAF) / Math.sqrt(3), d.nutHeight], [12, -d.nutAF / Math.sqrt(3), 2.5]),
    cylinder(d.mountHole / 2, 10, [12, 0, -1]),
  );
  return {
    id: 'fit-coupon',
    label: 'M3 hole and side-loaded nut fit coupon',
    shape,
    printShape: shape,
    role: 'cassette',
    color: 0x949da5,
  };
}

export function occurrence(piece: PrintedPiece, print = false): ConfiguredPiece {
  const definition = detailComponent(piece.id, piece.label, print ? piece.printShape : piece.shape, {
    nativeRefine: piece.nativeRefine !== false,
    preserveAuthoredFrame: piece.preserveAuthoredFrame === true || piece.nativeRefine === false,
  });
  definition.manufacturing = {
    material: 'PETG',
    blank: 'FDM print',
    processes: ['printing'],
    requirements: [
      'Use the supplied printing orientation. Qualify dimensions with the fit coupon.',
    ],
  };
  return {
    component: definition,
    label: piece.label,
    color: piece.color,
    requireSingleSolid: true,
  };
}

function libraryOccurrence(
  library: PartDefinition,
  id: string,
  name: string,
  parameters: Parameters,
  translation: Vec,
  color: number,
  supply: AssemblyComponent['supply'],
  rotation: Vec = [0, 0, 0],
  state = 'assembled',
  presetId?: string,
): ConfiguredPiece {
  return {
    component: {
      id,
      name,
      libraryId: library.id,
      ...(presetId ? { presetId } : {}),
      parameters,
      state,
      quantity: 1,
      supply,
      placement: { translation, rotation },
    },
    label: name,
    color,
  };
}

export function payload(p: Parameters): ConfiguredPiece[] {
  const d = layout(p);
  const items = [
    libraryOccurrence(
      grandado,
      'grandado',
      'Grandado 83 × 58 × 35 mm flanged enclosure',
      { model: 'grandado-83-58-35-clear' },
      [0, 0, d.boxTranslation],
      0x729d60,
      'purchased',
      [0, 0, 0],
      'body-only',
      'grandado-83-58-35-clear',
    ),
    libraryOccurrence(
      holder,
      'holder-3s',
      'BeiLaMoo 3S 18650 wire-lead holder · existing library model',
      { model: 'beilamoo-3s' },
      [0, 0, d.holderBottom],
      0x567fa5,
      'purchased',
      [0, 0, 0],
      'assembled',
      'beilamoo-3s',
    ),
  ];
  return [...items, ...factoryLidScrews(p)];
}

/** Four cutting operations on screws already supplied with the purchased enclosure. */
export function factoryLidScrews(p: Parameters): ConfiguredPiece[] {
  const spec = replacementLidSpec(p);
  const source = replacementLidFactoryScrews(p)[0];
  const firstSeat = spec.screwSeats[0];
  // Keep localizing transforms inside the recipe; an enclosing transform is
  // otherwise extracted by detailComponent as occurrence placement.
  const localShape: Shape = { kind: 'union', children: [
    move(source.shape, [-firstSeat.x, -firstSeat.y, -firstSeat.bearingZ]),
  ] };
  return spec.screwSeats.map((seat, index) => {
    const label = `Original Grandado lid screw ${index + 1} · tip shortened 2 mm`;
    const component = detailComponent(`grandado-lid-screw-${index + 1}`, label, localShape, {
      nativeRefine: false, preserveAuthoredFrame: true,
    });
    component.placement = { translation: [seat.x, seat.y, seat.bearingZ], rotation: [0, 0, 0] };
    component.notes = 'Source: purchased grandado occurrence / catalog-enclosure:grandado-83-58-35-clear; original supplied lid screw with 2 mm tip shortening. Included in the parent supplier unit; no additional procurement.';
    component.manufacturing = {
      material: 'Original supplier screw material; verify the delivered article',
      blank: 'Original screw included with the purchased Grandado enclosure',
      processes: ['cutting'],
      requirements: [
        'Measure actual screw length, thread, insert and blind-hole depth before trimming.',
        'Remove 2 mm from the original tip only; deburr and verify clamping before bottoming.',
      ],
    };
    return { component, label, color: source.color, requireSingleSolid: true };
  });
}

/** Existing library maximum-envelope cells, shared by inspection and retention audits. */
export function cellReferences(p: Parameters): ConfiguredPiece[] {
  const d = layout(p);
  return [-d.cellPitch, 0, d.cellPitch].map((y, i) =>
    libraryOccurrence(
      cell,
      `cell-reference-${i + 1}`,
      `18650 cell ${i + 1} · library envelope reference`,
      { model: 'molicel-p28a' },
      [-d.cellLength / 2, y, d.cellCenterZ],
      0x52799c,
      'reference',
      [0, 90, 0],
    ),
  );
}

export function hardware(p: Parameters): ConfiguredPiece[] {
  const extra = endRetainerHardware(p).map((item) => {
    const library = item.kind === 'screw' ? bolt : item.kind === 'nut' ? nut : washer;
    const parameters: Parameters =
      item.kind === 'screw'
        ? {
            ...bolt.defaults,
            diameter: item.diameter,
            shankDiameter: item.diameter,
            length: item.length!,
            head: item.head ?? 'socket-cap',
            headSize: item.headSize!,
            headHeight: item.headHeight!,
            drive: 'hex',
            driveWidth: item.driveWidth!,
            driveDepth: item.driveDepth!,
            pitch: item.pitch!,
            countersinkAngle: 90,
            tip: 'flat',
            tipDiameter: item.diameter - 1,
          }
        : item.kind === 'nut'
          ? {
              ...nut.defaults,
              bore: item.diameter,
              acrossFlats: item.acrossFlats!,
              height: item.height!,
              pitch: item.pitch!,
            }
          : { bore: item.bore!, outerDiameter: item.outerDiameter!, thickness: item.thickness! };
    return libraryOccurrence(
      library,
      item.id,
      item.label,
      parameters,
      item.translation,
      0xb6bcc3,
      'standard',
      item.rotation,
      'default',
    );
  });
  return extra;
}

export function referenceTubeBounds(_p: Parameters) {
  return { minX: -95, maxX: 95 };
}

export function tubeReference(p: Parameters, state: string): Shape {
  const d = layout(p), bounds = referenceTubeBounds(p), length = bounds.maxX - bounds.minX;
  let shape = subtract(
    { ...cylinder(d.radius, length, [bounds.minX, 0, 0], 'x'), previewSegments: 192 } as Shape,
    { ...cylinder(d.innerRadius, length + 2, [bounds.minX - 1, 0, 0], 'x'), previewSegments: 192 } as Shape,
  );
  if (state !== 'template')
    shape = subtract(
      shape,
      box(
        [d.windowLength, d.windowWidth, d.radius + 4],
        [-d.windowLength / 2, -d.windowWidth / 2, 0],
      ),
      ...[-d.endMountX,d.endMountX].flatMap(x => [0,90,180,270].map(angle => move(union(
        cylinder(d.mountHole / 2, 15, [x,0,d.innerRadius-1]), tubeCountersink(d,x),
      ),[0,0,0],[-angle,0,0]))),
      ...(d.antenna ? [cylinder(d.antennaHole / 2, d.radius + 2, [d.antennaX, d.antennaY, -d.radius - 1])] : []),
    );
  if (state === 'cutaway')
    shape = subtract(
      shape,
      box(
        [length + 2, d.radius + 2, 2 * d.radius + 4],
        [bounds.minX - 1, -d.radius - 2, -d.radius - 2],
      ),
    );
  return shape;
}

function reference(id: string, label: string, shape: Shape, color: number, preserveTopology = false): ConfiguredPiece {
  const component = detailComponent(id, label, shape, preserveTopology
    ? { nativeRefine: false, preserveAuthoredFrame: true } : undefined);
  component.supply = 'reference';
  return { component, label, color };
}

export function cableReference(p: Parameters): ConfiguredPiece {
  return reference('cable-routing-reference', 'Attached power lead · Grandado to underfloor cavity and positive end exit', cableWireReference(p), 0xe39039, true);
}

/** Canonical components do not depend on display state. The cutting tool is stored with the kit. */
export function composition(p: Parameters): AssemblyDefinition {
  const pieces = [...printedPieces(p).map((v) => occurrence(v)), ...payload(p), ...hardware(p)];
  return {
    components: pieces.map((v) => v.component),
    issues: [
      'The measured ears are 6 mm thick and use a default 6.2 mm capture pocket. The 99 mm ear pitch remains a photo estimate.',
      'Confirm connector projections before drilling the antenna feed-through.',
      'Qualify nut capture, cell keeper fit, screw engagement and wire routing on physical prints.',
      'The measured 22 mm hard body carries a 1.8 mm raised rim, with 23.8 mm total lower-body height. It enters the existing 2 mm channel with nominal 0.2 mm rigid headroom; gasket compression remains unqualified. Molded corners and the inferred support ledge still need fitting.',
      'Route the attached cable before sliding the lower assembly: the negative-end entry relief clears its complete closing sweep. Use the body-loading opening for the attached lead while seating Grandado, then keep the wire in the authored channel. No postassembly disconnection is assumed.',
    ],
  };
}

/** Occupied-envelope witness only; the actual gasket remains part of the enclosure interface. */
export function lidGasketReference(p: Parameters): ConfiguredPiece {
  return reference('lid-gasket-envelope-reference',
    'Gasket channel occupied-space reference · actual rubber profile unmeasured',
    replacementLidGasketReference(p), 0x365e45, true);
}

/** Each shape uses its authored print orientation, then receives a bed-plane placement. */
export function printLayout(p: Parameters, role?: PrintedPiece['role'], onlyIds?: string[]): ConfiguredPiece[] {
  const pieces = printedPieces(p).filter((v) => (!role || v.role === role) && (!onlyIds || onlyIds.includes(v.id)));
  let x = 0,
    y = 0,
    rowDepth = 0;
  return pieces.map((piece) => {
    const configured = occurrence(piece, true);
    const model = componentGeometry(libraries, [configured]);
    const bounds = new Box3().setFromObject(model, true),
      size = bounds.getSize(new Vector3());
    model.traverse((v) => {
      if (v instanceof Mesh) {
        v.geometry.dispose();
        for (const m of Array.isArray(v.material) ? v.material : [v.material]) m.dispose();
      }
    });
    if (x && x + size.x > 230) {
      x = 0;
      y += rowDepth + 10;
      rowDepth = 0;
    }
    configured.position = [x - bounds.min.x, y - bounds.min.y, -bounds.min.z];
    x += size.x + 10;
    rowDepth = Math.max(rowDepth, size.y);
    return configured;
  });
}

export function configuredPieces(
  p: Parameters,
  state: string,
  fabricatedOnly = false,
): ConfiguredPiece[] {
  if (state === 'fit-coupon') return [occurrence(fitCoupon(p))];
  if (state === 'cover-only') return printLayout(p,undefined,['grandado-curved-replacement-lid']);
  if (state === 'seal-interface') return [occurrence(replacementLidPieces(p)[0]), ...(!fabricatedOnly ? [lidGasketReference(p)] : [])];
  if (state === 'print-layout' || state === 'jig-print' || state === 'cassette-print')
    return printLayout(
      p,
      state === 'jig-print' ? 'jig' : state === 'cassette-print' ? 'cassette' : undefined,
    );
  const d = layout(p);
  let pieces = printedPieces(p)
    .filter((v) => (state === 'template' ? v.role === 'jig' : v.role === 'cassette'))
    .map((v) => occurrence(v));
  if (fabricatedOnly) return pieces;
  if (state !== 'template') {
    pieces.push(...hardware(p));
    if (p.showPayload) pieces.push(...payload(p));
    if (p.showPayload) {
      pieces.push(lidGasketReference(p));
      pieces.push(...cellReferences(p));
      pieces.push(cableReference(p));
      connectorReliefs(d).forEach((shape, i) =>
        pieces.push(
          reference(
            `connector-envelope-${i}`,
            [
              'SMA connector service envelope',
              'Ø19 power connector · inward body',
            ][i],
            shape,
            0xcf9552,
          ),
        ),
      );
      // A visible routing allowance, not a conductive or electrical model.
      pieces.push(
        reference(
          'holder-wire',
          '3S holder power-lead route · service allowance',
          cylinder(1.5, 14, [-d.holderLength / 2 - 14, 0, d.holderBottom + 7], 'x'),
          0x99544b,
        ),
      );
    }
  }
  if (p.showTube && state !== 'cassette' && state !== 'exploded')
    pieces.push(
      reference(
        'reference-tube',
        state === 'template'
          ? 'Ø90/86 tube · before cutting'
          : 'Ø90/86 tube · window and one-wall bores',
        tubeReference(p, state),
        0x667079,
      ),
    );
  if (state === 'exploded')
    pieces = pieces.map((piece, i) => {
      const id = piece.component.id;
      let delta: Vec = [0, 0, 0];
      if (id === 'grandado') delta = [0, 0, 60];
      else if (id === 'grandado-curved-replacement-lid' || id.startsWith('grandado-lid-screw-') || id === 'lid-gasket-envelope-reference') delta = [0, 0, 90];
      else if (id === 'upper-cylinder-shell') delta = [0, 0, 25];
      else if (id === 'lower-cylinder-negative') delta = [-18, 0, -45];
      else if (id === 'lower-cylinder-positive') delta = [18, 0, -45];
      else if (id === 'holder-3s' || id.startsWith('cell-reference')) delta = [0, 0, -10];
      else if (id === 'cell-keeper-bridge') delta = [0, 0, 8];
      else if (id.startsWith('end-disc-') || id.startsWith('disc-'))
        delta = [id.includes('negative') ? -35 : 35, 0, 0];
      else if (piece.component.supply === 'reference') delta = [0, i % 2 ? 22 : -22, 0];
      return { ...piece, position: delta };
    });
  return pieces;
}
