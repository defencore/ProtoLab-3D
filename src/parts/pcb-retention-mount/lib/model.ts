import type { Parameters } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import {
  box,
  cylinder,
  prism,
  subtract,
  union,
  type Shape,
  type Vec,
} from '../../../core/assembly/boundary/shapes';
import { pcbOpenTriangleSeat } from '../../../core/pcb-retention';
import {
  pcbBridgeBase,
  pcbBridgeLayout,
  pcbBridgePose,
  type PcbRetentionBridgeSpec,
} from '../../../core/pcb-retention-bridge';

export interface PcbMountBoard {
  id: string;
  index: number;
  x: number;
  y: number;
  length: number;
  width: number;
  seatZ: number;
  thickness: number;
}

export function layout(p: Parameters) {
  const count = Number(p.boardCount),
    gap = Number(p.boardGap),
    baseZ = Number(p.baseThickness),
    seatZ = Number(p.seatHeight),
    thickness = Number(p.boardThickness),
    c = Number(p.clearance),
    lock = p.lockEnabled === true,
    mode = String(p.antiFlexSupports),
    boards: PcbMountBoard[] = [];
  let cursor = 0;
  for (let i = 1; i <= count; i++) {
    const length = Number(p[`board${i}Length`]),
      width = Number(p[`board${i}Width`]);
    boards.push({ id: `pcb-${i}`, index: i, x: cursor, y: 0, length, width, seatZ, thickness });
    cursor += length + (i < count ? gap : 0);
  }
  const specs: PcbRetentionBridgeSpec[] = [];
  if (lock) {
    for (let i = 0; i < Math.max(1, count - 1); i++) {
      const left = boards[i],
        right = boards[i + 1],
        minWidth = Math.min(left.width, right?.width ?? left.width),
        maxWidth = Math.max(left.width, right?.width ?? left.width),
        station = 0.3 * minWidth;
      specs.push({
        centerX: left.x + left.length + gap / 2,
        gap,
        stationCentres: [-station + 1.5, station + 1.5],
        baseZ,
        seatZ,
        boardThickness: thickness,
        clearance: c,
        latchAnchor: Math.max(station + 5, maxWidth / 2 - 11),
        padMode: 'rigid',
      });
    }
  }
  const maxHalf = Math.max(...boards.map((b) => b.width / 2)),
    minX = -12,
    maxX = Math.max(cursor + 12, ...specs.map((s) => s.centerX + gap / 2 + 8)),
    minY = -maxHalf - 12,
    maxY = Math.max(maxHalf + 12, ...specs.map((s) => pcbBridgeLayout(s).latchAnchor + 30.7)),
    width = maxX - minX,
    depth = maxY - minY,
    inset = Number(p.mountingEdgeInset),
    holes: [number, number][] = p.mountingHoles
      ? [minX + inset, maxX - inset].flatMap((x) =>
          [minY + inset, maxY - inset].map((y): [number, number] => [x, y]),
        )
      : [];
  return {
    count,
    gap,
    baseZ,
    seatZ,
    thickness,
    c,
    lock,
    mode,
    boards,
    specs,
    minX,
    maxX,
    minY,
    maxY,
    width,
    depth,
    holes,
    holePitchX: width - 2 * inset,
    holePitchY: depth - 2 * inset,
  };
}

export const bridgeSpecs = (p: Parameters) => layout(p).specs;

/** Original outer-envelope operating principle; the inner guide seats remain open. */
function outerPocket(
  b: PcbMountBoard,
  left: boolean,
  side: -1 | 1,
  baseZ: number,
  c: number,
): Shape {
  const x = left ? b.x : b.x + b.length,
    ix = left ? 1 : -1,
    y = (side * b.width) / 2;
  return subtract(
    prism(
      [
        [x - 1.8 * ix, y + 1.8 * side],
        [x + 10.5 * ix, y + 1.8 * side],
        [x - 1.8 * ix, y - 10.5 * side],
      ],
      b.seatZ + b.thickness + c + 2 - baseZ + 0.1,
      baseZ - 0.1,
    ),
    box(
      [40, b.width + 2 * c, b.thickness + c],
      [left ? x - c : x - 40 + c, -b.width / 2 - c, b.seatZ],
    ),
  );
}

export function carrierFeatures(p: Parameters): Shape[] {
  const d = layout(p),
    out: Shape[] = [];
  for (const b of d.boards) {
    for (const left of [true, false]) {
      const roof = d.lock && (left ? b.index === 1 : d.count > 1 && b.index === d.count);
      for (const side of [-1, 1] as const) {
        if (roof) out.push(outerPocket(b, left, side, d.baseZ, d.c));
        else
          out.push(
            pcbOpenTriangleSeat({
              edgeX: left ? b.x : b.x + b.length,
              edgeY: (side * b.width) / 2,
              insideX: left ? 1 : -1,
              outsideY: side,
              seatZ: d.seatZ,
              baseZ: d.baseZ,
              boardThickness: d.thickness,
              clearance: d.c,
            }),
          );
      }
      if (!d.lock) {
        const wall = 1.8,
          x = left ? b.x - d.c - wall : b.x + b.length + d.c;
        for (const side of [-1, 1])
          out.push(
            box(
              [wall, 6, d.seatZ + d.thickness + d.c + 1.5 - d.baseZ + 0.1],
              [x, side * (b.width / 2 - 3) - 3, d.baseZ - 0.1],
            ),
          );
      }
    }
    if (['side', 'both'].includes(d.mode)) {
      for (const side of [-1, 1])
        out.push(
          box(
            [b.length - 8, 3, d.seatZ - d.baseZ + 0.1],
            [b.x + 4, side > 0 ? b.width / 2 - 4 : -b.width / 2 + 1, d.baseZ - 0.1],
          ),
        );
    }
    if (['under', 'both'].includes(d.mode)) {
      const spans = Math.max(1, Math.ceil((b.length - 16) / Number(p.supportPitch)));
      for (let i = 0; i <= spans; i++)
        out.push(
          box(
            [2.4, b.width - 12, d.seatZ - d.baseZ + 0.1],
            [b.x + 8 + ((b.length - 16) * i) / spans - 1.2, -b.width / 2 + 6, d.baseZ - 0.1],
          ),
        );
    }
  }
  // Carry bridge contact loads locally rather than bending the PCB to distant corners.
  d.specs.forEach((spec, index) => {
    for (const cy of spec.stationCentres) {
      const y = cy - 1.5 - 5;
      out.push(
        box([4, 10, d.seatZ - d.baseZ + 0.1], [spec.centerX - spec.gap / 2 - 4, y, d.baseZ - 0.1]),
      );
      if (d.boards[index + 1])
        out.push(
          box([4, 10, d.seatZ - d.baseZ + 0.1], [spec.centerX + spec.gap / 2, y, d.baseZ - 0.1]),
        );
    }
  });
  out.push(...d.specs.map(pcbBridgeBase));
  return out;
}

export function carrierShape(p: Parameters): Shape {
  const d = layout(p);
  const stock = union(box([d.width, d.depth, d.baseZ], [d.minX, d.minY, 0]), ...carrierFeatures(p));
  const holes = d.holes.map(([x, y]) =>
    cylinder(Number(p.mountingHoleDiameter) / 2, d.baseZ + 2, [x, y, -1]),
  );
  return holes.length ? subtract(stock, ...holes) : stock;
}

export function components(p: Parameters): AssemblyComponent[] {
  const d = layout(p);
  const definitions = [
    detailComponent(
      'carrier',
      'PCB carrier / open guides and configured support features',
      carrierShape(p),
      { preserveAuthoredFrame: true },
    ),
    ...d.specs.map((spec, i) => {
      const component = detailComponent(
        `bridge-${i + 1}`,
        `Removable PCB bridge ${i + 1}`,
        pcbBridgePose({ ...spec, centerX: 0 }),
        { preserveAuthoredFrame: true },
      );
      component.placement.translation = [spec.centerX, 0, 0];
      return component;
    }),
  ];
  return definitions.map((component) => ({
    ...component,
    manufacturing: {
      material: 'Project-selected printing polymer; specify grade, build orientation and settings',
      blank: 'Individually printed carrier or removable bridge',
      processes: ['printing'],
      requirements: [
        component.id === 'carrier'
          ? 'Print the carrier underside on Z=0; inspect mortise roofs and all contact lands.'
          : 'Print the bridge roof down; inspect the bayonet feet and release-leaf slot.',
        'Reserve PCB edge lands and selected underside support lines free of components, solder and exposed conductors. Verify board fit, assembly access, working loads, print anisotropy and service cycles.',
      ],
    },
  }));
}

export function referenceBoards(p: Parameters): { id: string; name: string; shape: Shape }[] {
  return layout(p).boards.map((b) => ({
    id: `reference-${b.id}`,
    name: `PCB ${b.index} bare-substrate installation reference`,
    shape: box([b.length, b.width, b.thickness], [b.x, -b.width / 2, b.seatZ]),
  }));
}

export function pieces(p: Parameters, state: string, references = true): ConfiguredPiece[] {
  const d = layout(p);
  const physical: ConfiguredPiece[] = components(p).map((source, i) => {
    const component = {
      ...source,
      placement: {
        translation: [...source.placement.translation] as Vec,
        rotation: [...source.placement.rotation] as Vec,
      },
    };
    let position: Vec = [0, 0, 0];
    if (i > 0 && ['service', 'exploded'].includes(state))
      position = [0, -3, d.seatZ + (state === 'exploded' ? 18 : 10)];
    if (i > 0 && state === 'print') {
      const spec = d.specs[i - 1],
        bridge = pcbBridgeLayout(spec);
      component.placement = {
        translation: [d.maxX + d.gap / 2 + 12 + (i - 1) * (d.gap + 16), 0, bridge.capTop],
        rotation: [180, 0, 0],
      };
    }
    return {
      component,
      label: component.name,
      color: i === 0 ? 0x879da4 : 0xe2ad53,
      requireSingleSolid: true,
      position,
    };
  });
  if (references && p.showReferences && state !== 'print') {
    physical.push(
      ...referenceBoards(p).map((board) => {
        const component = detailComponent(board.id, board.name, board.shape, {
          preserveAuthoredFrame: true,
        });
        component.supply = 'reference';
        return { component, label: board.name, color: 0x297866, requireSingleSolid: true };
      }),
    );
  }
  return physical;
}

export function validate(p: Parameters, state: string): string[] {
  const errors: string[] = [];
  if (!['assembled', 'service', 'exploded', 'print'].includes(state))
    errors.push('Choose an implemented PCB mounting state.');
  if (!Number.isInteger(Number(p.boardCount))) errors.push('PCB count must be a whole number.');
  if (Number(p.seatHeight) < Number(p.baseThickness) + (p.lockEnabled ? 5 : 1))
    errors.push(
      p.lockEnabled
        ? 'The locked mounting needs at least 5 mm between carrier top and PCB underside.'
        : 'The PCB seating plane must be at least 1 mm above the carrier top.',
    );
  if (errors.length) return errors;
  const d = layout(p);
  if (!['none', 'side', 'under', 'both'].includes(d.mode))
    errors.push('Choose an implemented additional support arrangement.');
  if (!d.lock && ['service', 'exploded'].includes(state))
    errors.push('The key-removal inspection states require the removable lock.');
  if (p.mountingHoles && Number(p.mountingEdgeInset) < Number(p.mountingHoleDiameter) / 2 + 1.2)
    errors.push('Mounting hole inset must leave at least 1.2 mm of carrier edge material.');
  return errors;
}
