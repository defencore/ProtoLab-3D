import { Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyDefinition } from '../../../core/product-types';
import { componentGeometry, type ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { disposeModel } from '../../../core/mechanical';
import { initializeManifoldGeometry } from '../../../core/assembly/manifold-boundary';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, union } from '../../../core/assembly/boundary/shapes';
import manufactured from '../../manufactured-detail/part';
import bolt from '../../bolt-screw/part';
import nut from '../../hex-nut/part';
import { flightPrinted, flightPayload, flightLibraries } from './flight';
import {
  powerPrinted,
  powerPayload,
  powerLibraries,
  powerCellFit,
  powerInterface,
  holderMountFit,
} from './power';
import { holderUnitObservation } from './holder-fit';
import { nosePrinted, nosePayload, noseLibraries, noseCableGauges } from './nose';
import { lowerCoverPartIds, radioReferences } from './radio';
import {
  servicePrinted,
  servicePayload,
  serviceLibraries,
  tailAnchorDisc,
  tubeShape,
  anchorStations,
} from './service';
import { at, cableGauges, printed, purchased, type PrintedItem } from './shared';
import { resolveTubeProfile } from './tube-interface';

export const libraries: PartDefinition[] = [
  ...new Map(
    [
      manufactured,
      bolt,
      nut,
      ...flightLibraries,
      ...powerLibraries,
      ...noseLibraries,
      ...serviceLibraries,
    ].map((part) => [part.id, part]),
  ).values(),
];
export const allPrinted = (p: Parameters): PrintedItem[] => {
  resolveTubeProfile(p);
  return [
    ...flightPrinted(p),
    ...powerPrinted(p).map((item) =>
      item.id === 'power-aft-disc' ? { ...item, shape: tailAnchorDisc(item.shape) } : item,
    ),
    ...nosePrinted(p),
    ...servicePrinted(p),
  ];
};
export async function initialize(p: Parameters) {
  await initializeManifoldGeometry();
  for (const piece of payload(p)) {
    const part = libraries.find((candidate) => candidate.id === piece.component.libraryId)!;
    await part.initializeGeometry?.(piece.component.parameters, piece.component.state);
  }
}
export const issues = [
  'Engineering reference only: no recovery attachment or deployment/impact load qualification. A separate verified tube/metal load path is required for the 10–15 kg vehicle and actual opening history.',
  'Grandado body drilling removes original inserts. Measure post stock, head bearing faces and couplers before fabrication. Fit the original raised rim and actual gasket to the restored upper-lid groove. Seal performance and IP rating remain unqualified.',
  'The eight through-cover M3 screws are intentionally not selected or counted. Choose their lengths from the finished seating planes and coupler position, then verify engagement and tip clearance.',
  'The user-measured M3×10 couplings side-load into integral anti-rotation seats with opposed bearing faces. Secure Grandado on the bench before inserting the core. Check the coupling fit coupon first.',
  'WING MINI pitch, USB accessory bore offsets, LCH7, ZX908 and generic camera/SSD mounting fidelity require physical fit checks.',
  'The NIKOM A448027 panel receptacle has an illustrative envelope. Fit the delivered socket and mating plug to the printed opening, transfer the flange holes to the solid drill lands and verify the user-wired LCH7 connection separately.',
  'ELRS25×13×4 and antenna20/10/25 mm are user-defined fitting envelopes; exact purchased receiver, cable diameter, tolerance and connector remain unidentified.',
  'The two 3S holders are independent units. Six generic Ø18.6 × 65.2 mm cell references are unprocured fitting gauges. The lower bank uses the user-measured 57.3 mm width and 1 mm rim recess; actual can diameter, holder internals, wiring and connector pinout still require the delivered parts.',
  'The UPS cell liner is omitted following the prototype closure test. The installed UPS bank bears against the separator; do not add a TPU layer in that closed stack. Lower-pan grooves reserve Ø1.5 mm insulated terminal wires.',
  'TPU geometry does not establish damping, creep life or NVMe recording reliability. Qualify temperature, travel, cooling and retention on a prototype.',
  'The integrated power aft closure and its separate TPU overlay have open cable channels. Define the actual CO2 discharge and venting; pressure and thermal sealing are unqualified.',
];

function anchors(): ConfiguredPiece[] {
  // Source DIN 7991 screws retain one purchased identity for all occurrences.
  const screw = bolt.presets.find(
    (v) =>
      v.parameters.diameter === 3 &&
      v.parameters.length === 12 &&
      v.parameters.head === 'countersunk',
  )!;
  const m3 = nut.presets.find((v) => v.id === 'gvyntok-474adfbe1cd7')!;
  return anchorStations.flatMap((x, i) =>
    [-1, 1].flatMap((sign) => [
      purchased(
        bolt,
        `tube-anchor-${i + 1}-${sign}`,
        screw.id,
        [x, sign * 38.7, 0],
        [sign > 0 ? -90 : 90, 0, 0],
        'default',
      ),
      purchased(
        nut,
        `tube-anchor-nut-${i + 1}-${sign}`,
        m3.id,
        // Seated at the closed outer reaction face; loading clearance is inward.
        [x, sign * 34.4, 0],
        // Match the clocked hex flanks while preserving the Y screw axis.
        [sign > 0 ? -90 : 90, sign > 0 ? 15 : -15, 0],
        'default',
      ),
    ]),
  );
}
export function payload(p: Parameters): ConfiguredPiece[] {
  resolveTubeProfile(p);
  return [
    ...flightPayload(p),
    ...powerPayload(p),
    ...nosePayload(p),
    ...anchors(),
    ...servicePayload(),
  ];
}

/** Generic fitting cans establish retention interfaces without selecting a cell SKU. */
export function powerCellReferences(): ConfiguredPiece[] {
  return powerCellFit.seats.map((seat, index) => {
    const label = `${seat.bank === 'ups' ? 'UPS' : 'Lower holder'} 18650 fitting reference ${(index % 3) + 1}`;
    const component = detailComponent(
      seat.id,
      label,
      cylinder(
        powerCellFit.referenceDiameter / 2,
        powerCellFit.referenceLength,
        [seat.center[0] - powerCellFit.referenceLength / 2, seat.center[1], seat.center[2]],
        'x',
      ),
      { nativeRefine: true, meshBackend: 'manifold' },
    );
    component.supply = 'reference';
    component.notes =
      'Unprocured generic Ø18.6 × 65.2 mm 18650 fitting envelope. Lower-bank positions are conditional on that diameter and the user-measured 57.3 mm total bank width and 1 mm rim recess. Exact cell model and tolerances are unselected. The purchased BeiLaMoo internal proxy is distinct from measured installation evidence. Excluded from physical composition and fabrication exports.';
    return { component, label, color: seat.bank === 'ups' ? 0x80a99a : 0x8ba2ba };
  });
}

/** Separate study gauges; never added to the product, UI state or finished BOM. */
export function holderFittingReferences(): ConfiguredPiece[] {
  const { body, legs } = holderUnitObservation;
  const { centerX } = powerInterface.holder;
  const undersideZ = holderMountFit.bodyBottomZ;
  const pitch = holderMountFit.cellPitch;
  const pitchUncertainty = (powerCellFit.referenceDiameter - powerCellFit.smallerDiameter) / 2;
  const terminalReserveWidth = Math.hypot(legs.width, legs.thickness) + 2 * pitchUncertainty;
  const shapes = [
    {
      id: 'power-holder-measured-envelope',
      label: 'User-measured holder exterior envelope',
      shape: box(
        [body.length, body.width, body.height],
        [centerX - body.length / 2, -body.width / 2, undersideZ],
      ),
    },
    ...[-pitch, 0, pitch].map((y, i) => ({
      id: `power-holder-terminal-corridor-${i + 1}`,
      label: `Unbent terminal position reserve ${i + 1}`,
      shape: box(
        [body.length, terminalReserveWidth, legs.length],
        [centerX - body.length / 2, y - terminalReserveWidth / 2, undersideZ - legs.length],
      ),
    })),
  ];
  return shapes.map(({ id, label, shape }) => {
    const component = detailComponent(id, label, shape, {
      nativeRefine: true,
      meshBackend: 'manifold',
    });
    component.supply = 'reference';
    component.notes = `${holderUnitObservation.sourceId} / measured project unit. Exterior and terminal-location fitting study only. The continuous terminal corridors conservatively cover unknown axial foot positions and conditional equal row pitch for Ø18.0–18.6 mm cans. These gauges do not reconstruct the holder cavity, contacts, insulation or spring stiffness.`;
    return { component, label, color: 0xdcb355 };
  });
}

/** Reserved bundle gauges are inspection references, not purchased wiring. */
export function cableRouteReferences(): ConfiguredPiece[] {
  const fore = noseCableGauges();
  return cableGauges().map((main, index) => {
    const side = index === 0 ? 'left' : 'right';
    const label = `Reserved ${side} cable route · Ø6 mm`;
    const component = detailComponent(
      `flight-cable-route-${side}`,
      label,
      union(fore[index], main),
      {
        nativeRefine: true,
        meshBackend: 'manifold',
      },
    );
    component.supply = 'reference';
    component.notes =
      'Continuous geometric reserve for one user-specified Ø6 bundle. Lay the harness into the open channels before installing the tube. Branch wiring, plug bodies and cable bend limits require the selected harness. Excluded from procurement and fabrication exports.';
    return { component, label, color: index === 0 ? 0xe99e35 : 0x3caeca };
  });
}
function belongs(id: string, module: string) {
  if (module === 'all') return true;
  const anchor = /^tube-anchor(?:-nut)?-(\d+)-/.exec(id);
  if (anchor) {
    const anchorModules = ['nose', 'flight', 'flight', 'spool', 'spool', 'power', 'power'];
    return (
      module === anchorModules[Number(anchor[1]) - 1] ||
      (module === 'tail' && Number(anchor[1]) === 7)
    );
  }
  if (module === 'flight') return /flight|grandado|wing|lch7|usb-|through-screw|coupler/.test(id);
  if (module === 'nose') return /nose|pi-|pcie|ssd|nvme-|gps|finder|camera/.test(id);
  if (module === 'power' && id.startsWith('tail-tie-')) return true;
  return id.startsWith(module);
}
/** One physical closure belongs to power and is inspectable from either view. */
function printedBelongs(item: PrintedItem, module: string) {
  return (
    module === 'all' ||
    item.module === module ||
    (module === 'tail' && item.id === 'power-aft-disc') ||
    (module === 'power' && item.id === 'tail-tpu-buffer')
  );
}
export function printPieces(p: Parameters): ConfiguredPiece[] {
  let x = 0,
    y = 0,
    row = 0;
  return allPrinted(p)
    .filter((item) => printedBelongs(item, String(p.module)))
    .map((item) => {
      const piece = printed(item, at(item.shape, [0, 0, 0], item.printRotation), true);
      const model = componentGeometry(libraries, [piece]);
      let bounds: Box3;
      try {
        bounds = new Box3().setFromObject(model, true);
      } finally {
        disposeModel(model);
      }
      const size = bounds.getSize(new Vector3());
      if (Math.max(size.x, size.y, size.z) > 256.001)
        throw new Error(`${item.id} exceeds the 256 mm printer envelope.`);
      // This is a parts catalogue of multiple beds, not one claimed 256 mm build plate.
      if (x + size.x > 250) {
        x = 0;
        y += row + 12;
        row = 0;
      }
      piece.position = [x - bounds.min.x, y - bounds.min.y, -bounds.min.z];
      x += size.x + 12;
      row = Math.max(row, size.y);
      return piece;
    });
}

export function tubeReference(p: Parameters, state: string) {
  if (!['all', 'flight'].includes(String(p.module))) return undefined;
  if (!['assembled', 'cutaway', 'service'].includes(state)) return undefined;

  const tube = printed({
    id: 'tube-reference',
    name: 'Ø90/86 D16T cut tube · reference only',
    shape: tubeShape(state === 'cutaway'),
    material: 'PETG',
    module: 'template',
  });
  const { manufacturing: _manufacturing, ...component } = tube.component;
  return {
    ...tube,
    component: {
      ...component,
      supply: 'reference' as const,
      notes:
        'User-selected D16T tube, nominal Ø90/86, shown as a reference envelope. Product form, delivered properties, tolerances, cut quality and recovery attachment remain unqualified.',
    },
    requireSingleSolid: false,
    color: 0x5c6573,
  };
}

export function configured(
  p: Parameters,
  state: string,
  excludeReferences = false,
  { includeTube = !excludeReferences && p.showTube === true }: { includeTube?: boolean } = {},
): ConfiguredPiece[] {
  resolveTubeProfile(p);
  if (state === 'print') return printPieces(p);
  if (state === 'cable-routes') {
    const hiddenCovers = new Set(['grandado-through-cover', 'flight-lower-cover', 'nose-shell']);
    const result = allPrinted(p)
      .filter((item) => item.module !== 'template' && !hiddenCovers.has(item.id))
      .map((item) => printed(item));
    result.push(...payload(p));
    if (!excludeReferences) result.push(...cableRouteReferences(), ...powerCellReferences());
    return result;
  }
  if (state === 'lower-cover') {
    const ids = new Set<string>(lowerCoverPartIds);
    const result = allPrinted(p)
      .filter((item) => ids.has(item.id))
      .map((item) => printed(item));
    if (!excludeReferences) result.push(...radioReferences(p));
    return result;
  }
  const selected = allPrinted(p).filter((item) =>
    state === 'templates'
      ? item.module === 'template'
      : item.module !== 'template' && printedBelongs(item, String(p.module)),
  );
  let pieces = selected.map((item) => printed(item));
  if (state !== 'templates' && p.showElectronics)
    pieces.push(...payload(p).filter((item) => belongs(item.component.id, String(p.module))));
  if (
    state !== 'templates' &&
    p.showElectronics &&
    !excludeReferences &&
    ['all', 'flight'].includes(String(p.module))
  )
    pieces.push(...radioReferences(p));
  if (
    state !== 'templates' &&
    p.showElectronics &&
    !excludeReferences &&
    ['all', 'power'].includes(String(p.module))
  )
    pieces.push(...powerCellReferences());
  if (includeTube) {
    const tube = tubeReference(p, state);
    if (tube) pieces.push(tube);
  }
  if (state === 'service')
    pieces = pieces.map((item) => ({
      ...item,
      position:
        item.component.id === 'grandado-through-cover'
          ? [0, 0, 60]
          : (lowerCoverPartIds as readonly string[]).includes(item.component.id)
            ? [0, 0, -50]
            : item.component.id === 'nose-shell'
              ? [-180, 0, 0]
              : item.component.id.startsWith('nose-shell-screw-')
                ? [0, 12 * Math.sign(item.component.placement.translation[1]), 0]
                : [0, 0, 0],
    }));
  return pieces;
}
export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: [
      ...allPrinted(p).map((item) => printed(item).component),
      ...payload(p).map((item) => item.component),
    ],
    issues,
  };
}
