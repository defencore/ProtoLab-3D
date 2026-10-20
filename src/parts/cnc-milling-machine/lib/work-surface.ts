import type { Parameters, PartDefinition } from '../../../core/types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import type { MillingPiece, Motion } from './composition';
import type { FrameHole } from '../../cnc-frame-part/part';
import { frameManufacturing } from '../../cnc-frame-part/part';
import table, { worktableParameters, worktableLayout } from '../../cnc-worktable/part';
import washer from '../../washer/part';
import nut from '../../hex-nut/part';
import type { millingLayout } from './layout';
export interface WorkSurfaceCallbacks {
  add: (
    id: string,
    part: PartDefinition,
    parameters: Parameters,
    state: string,
    translation: Vec,
    rotation?: Vec,
    motion?: Motion,
    section?: MillingPiece['section'],
    color?: number,
    presetId?: string,
  ) => void;
  fabricated: (
    id: string,
    role: string,
    size: Vec,
    at: Vec,
    holes?: FrameHole[],
    motion?: Motion,
    material?: string,
    extra?: Parameters,
    rotation?: Vec,
    section?: MillingPiece['section'],
  ) => void;
  fastener: (
    id: string,
    d: number,
    length: number,
    headSeat: Vec,
    normal: Vec,
    motion?: Motion,
    section?: MillingPiece['section'],
  ) => void;
}
/** The work surface and shallow drip tray have independent, accessible mounting stacks. */
export function addWorkSurface(
  p: Parameters,
  v: ReturnType<typeof millingLayout>,
  h: WorkSurfaceCallbacks,
  out: MillingPiece[],
) {
  const shift = (at: Vec): Vec => [at[0], at[1] + v.tableCenterY, at[2]];
  const add: WorkSurfaceCallbacks['add'] = (id, part, parameters, state, at, ...rest) =>
    h.add(id, part, parameters, state, shift(at), ...rest);
  const fabricated: WorkSurfaceCallbacks['fabricated'] = (id, role, size, at, ...rest) =>
    h.fabricated(id, role, size, shift(at), ...rest);
  const fastener: WorkSurfaceCallbacks['fastener'] = (id, d, length, at, ...rest) =>
    h.fastener(id, d, length, shift(at), ...rest);
  const mark = (
    material: string,
    blank: string,
    processes: ('milling' | 'cutting' | 'drilling' | 'bending')[],
    requirements: string[],
  ) => {
    out[out.length - 1].component.manufacturing = { material, blank, processes, requirements };
  };
  for (let i = 0; i < 10; i++) {
    const x = (i - 4.5) * 100.5;
    const parameters = worktableParameters('slat', {
      threadFitAllowance: 0.05,
      thickness: v.tableThickness,
    });
    add(
      'aluminium-table-slat-' + i,
      table,
      parameters,
      'default',
      [x, 0, v.tableBottom],
      [0, 0, 0],
      'fixed',
      'bed',
      0xbbc2c5,
    );
    mark(
      'Aluminium 6061-T6, authored choice',
      `100 x1800 x${v.tableThickness} mm plate`,
      ['milling', 'drilling'],
      [
        'Machine T-slots and blind underside M6 threads.',
        'Machine installed top faces coplanar; verify actual workholding loads and datum flatness.',
      ],
    );
    for (const [j, hole] of worktableLayout(parameters).holes.entries()) {
      const at: Vec = [x + hole.center[0], hole.center[1], v.tableBottom - v.tableRibHeight - 1.6];
      // The 3.2 mm spacer gives the selected standard-length screw 6.8 mm engagement in the blind 8 mm tap.
      fabricated(
        `table-slat-${i}-spacer-${j}`,
        'crush-sleeve',
        [18, 18, 3.2],
        at,
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 18, sleeveBore: 6.6 },
        [0, 0, 0],
        'bed',
      );
      fastener(
        `table-slat-${i}-rib-bolt-${j}`,
        6,
        v.tableRibHeight + 10,
        [at[0], at[1], v.tableBottom - v.tableRibHeight - 3.2],
        [0, 0, -1],
        'fixed',
        'bed',
      );
    }
  }
  if (!p.coolant) return;
  const t = 2,
    w = 1060,
    l = 1860,
    bottom = v.panFloor,
    top = bottom + t,
    // Keep the whole formed wall below the rib and its underside fastening envelope.
    // The tray collects drips; a separate splash enclosure is required for flood coolant.
    wallHeight = v.tableBottom - v.tableRibHeight - 25 - top;
  const floorParameters = worktableParameters('pan-floor', {
    width: w,
    length: l,
    thickness: t,
    edgeMount: 12,
    mountBoltDiameter: 4,
    supportSpacing: 700,
  });
  add(
    'coolant-pan-floor',
    table,
    floorParameters,
    'default',
    [0, 0, bottom],
    [0, 0, 0],
    'fixed',
    'bed',
    0xa1afb5,
  );
  mark(
    'Stainless steel304, authored water-based-coolant choice',
    `${w} x${l} x${t} mm sheet`,
    ['cutting', 'drilling'],
    [
      'Deburr holes; seal corner drain and all wall joints with compatible sealant.',
      'Support the tray with all twelve hangers; qualify sheet deflection and drainage slope.',
    ],
  );
  for (const side of [-1, 1]) {
    add(
      'coolant-pan-side-' + side,
      table,
      worktableParameters('pan-side', {
        length: l,
        width: wallHeight,
        thickness: t,
        mountBoltDiameter: 4,
        edgeMount: 12,
        bendRadius: 2,
      }),
      'default',
      [(side * w) / 2, 0, top],
      [0, 0, side < 0 ? 0 : 180],
      'fixed',
      'bed',
      0xa1afb5,
    );
    mark(
      'Stainless steel304',
      '1860 mm formed rail, thickness2 mm',
      ['cutting', 'drilling', 'bending'],
      [
        'Inner bend radius2 mm; side flange ends relieved20 mm.',
        'Seal vertical corner joint to the end wall and flange to floor.',
        'Keep the upper edge25 mm below the ribs. No structural members pass through the formed wall.',
        'This shallow tray collects drips only. Qualify drainage and leakage; provide a separate splash enclosure for flood coolant.',
      ],
    );
    add(
      'coolant-pan-end-' + side,
      table,
      worktableParameters('pan-end', {
        length: w - 2 * t,
        width: wallHeight,
        thickness: t,
        mountBoltDiameter: 4,
        edgeMount: 12,
        bendRadius: 2,
      }),
      'default',
      [0, (side * l) / 2, top],
      [0, 0, side < 0 ? 90 : -90],
      'fixed',
      'bed',
      0xa1afb5,
    );
    mark(
      'Stainless steel304',
      '1056 mm formed rail, thickness2 mm',
      ['cutting', 'drilling', 'bending'],
      [
        'Inner bend radius2 mm; ends fit between the side webs.',
        'Seal vertical corner joint and flange to floor.',
      ],
    );
  }
  const ring = (
    id: string,
    bore: number,
    od: number,
    thickness: number,
    z: number,
    x: number,
    y: number,
    sealing = false,
  ) => {
    add(
      id,
      washer,
      { ...washer.defaults, bore, outerDiameter: od, thickness },
      'default',
      [x, y, z],
      [0, 0, 0],
      'fixed',
      'bed',
      sealing ? 0x303b39 : 0x92999e,
    );
    if (sealing) {
      out[out.length - 1].component.supply = 'manufactured';
      mark(
        'NBR70 sheet; verify with selected coolant',
        `Annular seal D${od}/d${bore} x${thickness}`,
        ['cutting'],
        [
          'Cut a continuous washer from compatible sheet; qualify compression and fluid resistance.',
        ],
      );
    }
  };
  const floor = worktableLayout(floorParameters);
  for (const [i, hole] of floor.holes.entries()) {
    const [x, y] = hole.center;
    if (hole.diameter < 6) {
      fastener('pan-seam-bolt-' + i, 4, 10, [x, y, top + t], [0, 0, 1], 'fixed', 'bed');
      ring('pan-seam-seal-' + i, 4.3, 9, 0.5, bottom - 0.25, x, y, true);
      ring('pan-seam-washer-' + i, 4.3, 9, 0.8, bottom - 0.9, x, y);
      add(
        'pan-seam-nut-' + i,
        nut,
        { ...nut.defaults, bore: 4, acrossFlats: 7, height: 3.2, pitch: 0.7 },
        'default',
        [x, y, bottom - 4.5],
        [0, 0, 0],
        'fixed',
        'bed',
        0x92999e,
      );
    } else {
      const gap = v.tableBottom - v.tableRibHeight - top;
      fabricated(
        'pan-hanger-spacer-' + i,
        'crush-sleeve',
        [12, 12, gap],
        [x, y, top + gap / 2],
        [],
        'fixed',
        'steel',
        { sleeveDiameter: 12, sleeveBore: 6.6 },
        [0, 0, 0],
        'bed',
      );
      ring('pan-hanger-seal-' + i, 6.4, 12, 0.5, bottom - 0.25, x, y, true);
      ring('pan-hanger-washer-' + i, 6.4, 12, 1.6, bottom - 1.3, x, y);
      // A standard10 mm length increment gives7.9 mm engagement in the open8 mm rib wall.
      const hangerLength = Math.floor((gap + t + 2.1 + v.tableRibWall) / 10) * 10;
      fastener(
        'pan-hanger-bolt-' + i,
        6,
        hangerLength,
        [x, y, bottom - 2.1],
        [0, 0, -1],
        'fixed',
        'bed',
      );
      const row = floor.supportRows.findIndex((row) => Math.abs(row - y) < 0.001);
      const rib = out.find((item) => item.component.id === 'table-rib-' + (row + 1));
      if (!rib) throw new Error('Every pan hanger must have a matching stationary table rib.');
      const holes: FrameHole[] = JSON.parse(String(rib.component.parameters.holes));
      holes.push({
        axis: 'z',
        at: [x, 0, -v.tableRibHeight / 2],
        diameter: 6,
        depth: v.tableRibWall,
        threadPitch: 1,
        threadDesignation: 'M6',
      });
      rib.component.parameters = { ...rib.component.parameters, holes: JSON.stringify(holes) };
      rib.component.manufacturing = frameManufacturing(rib.component.parameters);
    }
  }
}
