import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { box, cylinder, union, subtract, type Shape } from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import manufactured from '../../manufactured-detail/part';
import purchased from '../../purchased-component/part';
import { hardware, libraries as hardwareLibraries } from './hardware';
import { layout } from './layout';
import { rounded, hex, xtOpening } from './shapes';
import {
  latch,
  latchShape,
  latchHousing,
  latchHousingCuts,
  latchCover,
  lidHooks,
  lidKeeper,
  lidBevel,
  lidPoseShape,
} from './closure';
export { latchShape, lidPoseShape } from './closure';
import { ribbonShape } from './ribbon';
export const libraries: PartDefinition[] = [manufactured, purchased, ...hardwareLibraries];
export interface ModulePiece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  supply: 'manufactured' | 'purchased';
  process?: 'printing' | 'drilling';
  designation?: string;
  source?: string;
}
export const printedIds = [
  'frame',
  'lid',
  'rear-tray',
  'latch-slider',
  'latch-cover',
  'holder-clamp-left',
  'holder-clamp-right',
  'panel-clamp-left',
  'panel-clamp-right',
];
export const hostOpening = (p: Parameters, z: number, t: number) => {
  const d = layout(p);
  return rounded(d.cutoutLength, d.cutoutWidth, d.cutoutRadius, d.bodyCentre, z, t);
};
export function pieces(p: Parameters): ModulePiece[] {
  const d = layout(p),
    out: ModulePiece[] = [];
  const add = (
    id: string,
    label: string,
    shape: Shape,
    color: number,
    supply: ModulePiece['supply'] = 'manufactured',
    designation?: string,
    process: ModulePiece['process'] = 'printing',
  ) => out.push({ id, label, shape, color, supply, designation, process });
  const holes = (
    points: readonly (readonly [number, number])[],
    diam: number,
    z: number,
    t: number,
  ) => points.map(([x, y]) => cylinder(diam / 2, t, [x, y, z]));
  const inserts = (id: string, points: readonly (readonly [number, number])[], from: number) =>
    points.forEach(([x, y], i) =>
      add(
        `${id}-${i + 1}`,
        'M3 heat-set insert / 4.6 OD x 4 mm',
        subtract(cylinder(2.3, 4, [x, y, from]), cylinder(1.5, 4.2, [x, y, from - 0.1])),
        0xb89a45,
        'purchased',
        'M3 brass heat-set insert / 4.6 OD x 4 mm; test 4.2 mm pilot',
      ),
    );
  const bolt = (
    id: string,
    label: string,
    x: number,
    y: number,
    under: number,
    length: number,
    diam = 3,
    head = 5.6,
    height = 2.4,
  ) =>
    add(
      id,
      label,
      union(
        cylinder(diam / 2, length, [x, y, under - length]),
        cylinder(head / 2, height, [x, y, under]),
      ),
      0xaeb7c0,
      'purchased',
      label,
    );
  const nut = (id: string, x: number, y: number, z: number, diam = 3, af = 5.5, t = 2.4) => {
    const thread = `M${diam}`;
    return add(
      id,
      `${thread} hex nut`,
      subtract(hex(af, z, t, [x, y]), cylinder(diam / 2, t + 0.2, [x, y, z - 0.1])),
      0x9aa4ae,
      'purchased',
      `${thread} hex nut / ${af} AF x ${t} mm`,
    );
  };
  const xtHoles = [-1, 1].map((s) => [d.xtCentre[0], d.xtCentre[1] + s * 12.5] as [number, number]);
  const frame = union(
    subtract(
      rounded(d.bodyLength, d.bodyWidth, 5, d.bodyCentre, -33, 33),
      rounded(d.bodyLength - 6, d.bodyWidth - 6, 3, d.bodyCentre, -34, 35),
    ),
    rounded(d.flangeLength, d.flangeWidth, 5, d.bodyCentre, 0, 4),
    ...d.caseHoles.map(([x, y]) => cylinder(5, 37, [x, y, -33])),
    latchHousing(),
    ...xtHoles.map(([x, y]) => cylinder(5, 3.6, [x, y, -3.6])),
  );
  add(
    'frame',
    'Panel bezel and open-bottom shell',
    union(
      cylinder(3, 4, [55.5, -5, -5.8], 'x'),
      subtract(
        frame,
        rounded(d.openingLength, d.openingWidth, 3, [0, 0], -0.1, 4.2),
        xtOpening(d.xtCentre, -3.7, 7.8),
        box([3.4, 24, 18.2], [-60.2, -12, -33.1]),
        ...[-1, 1].map((s) => rounded(20, 10, 3, [0, (s * d.lidWidth) / 2], 2, 2.1)),
        ...holes(d.caseHoles, 3.4, -34, 39),
        ...holes(d.caseHoles, 10.6, -33.1, 4.1),
        ...holes(d.panelHoles, 4.5, -0.1, 4.2),
        ...latchHousingCuts(),
        ...holes(xtHoles, 3.4, -3.7, 7.8),
        ...xtHoles.map((c) => hex(5.8, -3.7, 2.8, c)),
      ),
    ),
    0x475a69,
  );
  const ribLength = d.holder.width - 7;
  const ribs = [-20, 20].map((x) => rounded(8, ribLength, 2, [x, 0], -1.5, 5.5));
  add(
    'lid',
    `${p.pack} hook-in battery lid`,
    subtract(
      union(
        rounded(d.lidLength, d.lidWidth, 5, [0, 0], 4, 3.2),
        ...ribs,
        ...lidHooks(p),
        lidKeeper(),
      ),
      rounded(14, 4.5, 1.5, [0, 0], 3.9, 3.4),
      lidBevel(p),
    ),
    0x728997,
  );
  add('latch-slider', 'Recessed spring-return sliding bolt / 4 mm travel', latchShape(p), 0xb99a46);
  add('latch-cover', 'Flat removable latch channel cover', latchCover(), 0x607889);
  [-1, 1].forEach((sign, i) => {
    const x = sign * d.holderClampX;
    const contact = sign * d.holderContactX;
    const fingers = [-1, 1].flatMap((s) => {
      const y = s * d.holderClampY;
      const left = Math.min(contact - 0.5, x - 4.5);
      const right = Math.max(contact + 0.5, x + 4.5);
      return [
        box([right - left, 6, 3], [left, y - 3, -3.26]),
        box([1, 6, 0.3], [contact - 0.5, y - 3, d.holderContactZ]),
      ];
    });
    add(
      i === 0 ? 'holder-clamp-left' : 'holder-clamp-right',
      'M3 holder end-wall retaining rail / no holder drilling',
      subtract(
        union(
          rounded(9, 2 * d.holderClampY + 9, 3, [x, 0], -3.26, 3),
          ...(sign === 1
            ? [
                box([9, 33, 3], [x - 4.5, -17, -18]),
                box([9, 3, 17.74], [x - 4.5, -17, -18]),
                box([9, 3, 17.74], [x - 4.5, 13, -18]),
              ]
            : []),
          ...fingers,
          ...[-1, 1].map((s) => cylinder(4.5, 7.74, [x, s * d.holderClampY, -8])),
        ),
        ...holes(
          [
            [x, -d.holderClampY],
            [x, d.holderClampY],
          ],
          3.4,
          -8.1,
          8,
        ),
        ...[-1, 1].map((s) => hex(5.8, -6.6, 6.5, [x, s * d.holderClampY])),
        ...(sign === 1 ? [box([9.2, 27, 4], [x - 4.6, -14, -3.3])] : []),
      ),
      0x607889,
    );
  });
  for (const [i, x] of [-20, 20].entries())
    add(
      `lid-foam-${i + 1}`,
      'Soft cell retention strip / nominal compression',
      box([8, ribLength, 3], [x - 4, -ribLength / 2, -4.5]),
      0x30373a,
      'purchased',
      'Soft closed-cell foam 8 mm wide x 3 mm thick; fit gentle cell preload',
    );
  add(
    'extraction-ribbon',
    'Soft fabric cell-extraction sling and finger loop',
    ribbonShape(p),
    0xd36b37,
    'purchased',
    'Polyester ribbon 12 mm wide x nominal 0.4 mm thick; sewn flat loop, no hard buckle; measure and fit length',
  );
  const tray = union(
    rounded(d.bodyLength, d.bodyWidth, 5, d.bodyCentre, -36, 3),
    ...d.boardHoles.map(([x, y]) => cylinder(4.5, 6.5, [x, y, -33])),
    ...d.balanceSupportAxes.map(([x, y]) => cylinder(3, 6.5, [x, y, -33])),
    ...d.caseHoles.map(([x, y]) => cylinder(5, 4, [x, y, -33])),
    ...d.holderClampAxes.map(([x, y]) => cylinder(4.5, 25, [x, y, -33])),
  );
  add(
    'rear-tray',
    'Flat rear tray and PCB standoffs',
    subtract(
      tray,
      ...holes(d.caseHoles, 3.4, -36.1, 7.2),
      ...d.caseHoles.map((c) => hex(5.8, -36.1, 3.3, c)),
      ...holes(d.holderClampAxes, 3.4, -36.1, 28.2),
      ...holes(d.holderClampAxes, 6.2, -36.1, 2.5),
      ...holes(d.boardHoles, 2.5, -32, 5.6),
    ),
    0x607889,
  );
  // A prepared donor-board envelope shows all installation-critical holes.
  // Unused original perfboard holes/pads are deliberately omitted, not filled in production.
  add(
    'prepared-board',
    `Prepared ${d.boardLength} x ${d.boardWidth} mm PY perfboard / cut and drill pattern`,
    subtract(
      box([d.boardLength, d.boardWidth, 1.5], [d.boardLeft, -d.boardWidth / 2, -26.5]),
      ...holes(d.boardHoles, 3.4, -26.6, 1.7),
      ...holes(d.boardReliefs, 10, -26.6, 1.7),
      ...d.boardReliefs.map(([x, y]) =>
        box([x - d.boardLeft + 0.2, 10, 1.7], [d.boardLeft - 0.1, y - 5, -26.6]),
      ),
      ...holes(d.holderPins, 1.8, -26.6, 1.7),
      ...holes(d.balancePins, 1.1, -26.6, 1.7),
    ),
    0x188766,
    'manufactured',
    undefined,
    'drilling',
  );
  inserts('latch-cover-insert', latch.coverAxes, -10.5);
  latch.coverAxes.forEach(([x, y], i) =>
    add(
      `latch-cover-screw-${i + 1}`,
      'M3 x 10 countersunk latch cover screw / rear insertion',
      {
        kind: 'transform',
        translation: [x, y, 0],
        rotation: [0, 0, 0],
        child: {
          kind: 'revolve',
          profile: [
            [0, -13.8],
            [3, -13.8],
            [1.5, -12.3],
            [1.5, -3.8],
            [0, -3.8],
          ],
        },
      },
      0xaeb7c0,
      'purchased',
      'M3 x 10 countersunk screw / 10 mm total length',
    ),
  );
  d.caseHoles.forEach(([x, y], i) => {
    bolt(`case-screw-${i + 1}`, 'M3 x 40 shell tie screw', x, y, 4, 40);
    nut(`case-nut-${i + 1}`, x, y, -35.2);
  });
  d.boardHoles.forEach(([x, y], i) =>
    bolt(`board-screw-${i + 1}`, 'M3 x 6 PCB mounting screw', x, y, -25, 6),
  );
  d.holderClampAxes.forEach(([x, y], i) => {
    add(
      `holder-clamp-screw-${i + 1}`,
      'M3 x 30 holder rail screw / rear insertion',
      union(cylinder(1.5, 30, [x, y, -33.6]), cylinder(2.8, 2.4, [x, y, -36])),
      0xaeb7c0,
      'purchased',
      'M3 x 30 pan-head screw / nominal 2.4 mm head height',
    );
    nut(`holder-clamp-nut-${i + 1}`, x, y, -6.6);
  });
  [-1, 1].forEach((s, i) => {
    const x = d.xtCentre[0],
      y = d.xtCentre[1] + s * 12.5;
    add(
      `xt-screw-${i + 1}`,
      'M3 x 12 countersunk XT60 flange screw',
      {
        kind: 'transform',
        rotation: [0, 0, 0],
        translation: [x, y, 0],
        child: {
          kind: 'revolve',
          profile: [
            [0, -3.9],
            [1.5, -3.9],
            [1.5, 6.4],
            [3, 8.1],
            [0, 8.1],
          ],
        },
      },
      0xaeb7c0,
      'purchased',
      'M3 x 12 countersunk screw / 12 mm total length, AMASS front-seat envelope',
    );
    nut(`xt-nut-${i + 1}`, x, y, -3.4);
  });
  d.panelHoles.forEach(([x, y], i) => {
    bolt(
      `panel-screw-${i + 1}`,
      `M4 x ${d.panelBoltLength} host panel screw`,
      x,
      y,
      4,
      d.panelBoltLength,
      4,
      7,
      4,
    );
    nut(`panel-nut-${i + 1}`, x, y, -d.panelThickness - 4.7, 4, 7, 3.2);
  });
  [-65.5, 97.5].forEach((x, i) => {
    const points = d.panelHoles.filter(([px]) => px === x);
    const span = points[1][1] - points[0][1];
    add(
      i === 0 ? 'panel-clamp-left' : 'panel-clamp-right',
      'Rear panel clamping strip with recessed M4 nuts',
      subtract(
        union(
          box([8, span, 5], [x - 4, points[0][1], -d.panelThickness - 5]),
          ...points.map(([px, y]) => cylinder(7, 5, [px, y, -d.panelThickness - 5])),
        ),
        ...holes(points, 4.5, -d.panelThickness - 5.1, 5.2),
        ...points.map((c) => hex(7.3, -d.panelThickness - 5.1, 3.7, c)),
      ),
      0x607889,
    );
  });
  if (p.showCells)
    d.pinRows.forEach((y, i) =>
      add(
        `cell-${i + 1}`,
        'Reference protected button-top 18650 / 68 x 18.3 mm',
        cylinder(d.cellDiameter / 2, d.cellLength, [-34, y, d.cellZ], 'x'),
        0x3897a1,
        'purchased',
        'Reference cell envelope / verify delivered cell and MPD compatibility',
      ),
    );
  if (p.showPanel)
    add(
      'host-panel',
      'Reference host panel / cutting pattern',
      subtract(
        rounded(
          d.flangeLength + 30,
          d.flangeWidth + 30,
          5,
          d.bodyCentre,
          -d.panelThickness,
          d.panelThickness,
        ),
        hostOpening(p, -d.panelThickness - 0.1, d.panelThickness + 0.2),
        ...holes(d.panelHoles, 4.5, -d.panelThickness - 0.1, d.panelThickness + 0.2),
      ),
      0x7c8289,
      'purchased',
      'Host panel / authored reference, not a module part',
    );
  return out;
}
function component(piece: ModulePiece): AssemblyComponent {
  const c = detailComponent(piece.id, piece.label, piece.shape);
  if (piece.supply === 'purchased') {
    c.libraryId = 'purchased-component';
    c.supply = 'purchased';
    c.procurement = {
      designation: piece.designation!,
      manufacturer: '',
      source: 'Nominal installation envelope / select actual hardware',
    };
  } else
    c.manufacturing = {
      material:
        piece.process === 'drilling'
          ? 'Prepared FR4 donor perfboard'
          : 'PETG / qualify actual print',
      blank: piece.process === 'drilling' ? piece.label : 'FDM print',
      processes: piece.process === 'drilling' ? ['cutting', 'drilling'] : ['printing'],
      requirements:
        piece.process === 'drilling'
          ? [
              'Use the Hole pattern view or exported drill drawing; verify delivered stock. Unused stock perforations and copper pads are omitted from this installation envelope.',
            ]
          : [
              'Use Print layout orientation. Remove local supports if required; test screw and insert fits before final assembly.',
            ],
    };
  return c;
}
export function composition(p: Parameters): AssemblyDefinition {
  return {
    components: [...pieces(p).map(component), ...hardware(p).map((v) => v.component)],
    issues: [
      'MPD contacts are independent: author insulated series links and every balance node; the enclosure is not a BMS or a completed battery circuit.',
      'Keep high-current wiring separate from isolated perfboard pads. Verify pin numbering, polarity and chosen holder/cell ratings.',
      'Four M4 panel bolts mount the fixed flange. Retract the recessed spring bolt, tilt the lid, feed its soft sling loop through the slot, then withdraw the two under-rim hooks.',
    ],
  };
}
export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  const d = layout(p);
  if (state === 'print-layout') {
    return pieces(p)
      .filter((v) => printedIds.includes(v.id))
      .map((v, i) => {
        const offsets: Record<string, [number, number, number]> = {
          frame: [0, 0, 4],
          lid: [0, 0, 7.2],
          'rear-tray': [0, 0, 36],
          'latch-slider': [-48, 0, 10],
          'latch-cover': [-52, 5, 13.8],
          'holder-clamp-left': [d.holderClampX, 0, -0.26],
          'holder-clamp-right': [0, 0, d.holderClampX + 4.5],
          'panel-clamp-left': [65.5, 0, -d.panelThickness],
          'panel-clamp-right': [-97.5, 0, -d.panelThickness],
        };
        const flip = [
          'frame',
          'lid',

          'holder-clamp-left',
          'panel-clamp-left',
          'panel-clamp-right',
        ].includes(v.id);
        const base = offsets[v.id];
        const posed: ModulePiece = {
          ...v,
          shape: {
            kind: 'transform',
            child: v.shape,
            rotation:
              v.id === 'holder-clamp-right'
                ? [0, 90, 0]
                : v.id === 'latch-slider'
                  ? [90, 0, 0]
                  : [flip ? 180 : 0, 0, 0],
            translation: [i * 210 + base[0], base[1], base[2]],
          },
        };
        return {
          component: component(posed),
          label: v.label,
          color: v.color,
          requireSingleSolid: true,
        };
      });
  }
  if (state === 'panel-template') {
    const shape = subtract(
      rounded(d.flangeLength + 12, d.flangeWidth + 12, 4, d.bodyCentre, 0, 2),
      hostOpening(p, -0.1, 2.2),
      ...d.panelHoles.map(([x, y]) => cylinder(2.25, 2.2, [x, y, -0.1])),
    );
    const v: ModulePiece = {
      id: 'panel-template',
      label: 'Panel cutout and four M4 drill locations',
      shape,
      color: 0xc28d42,
      supply: 'manufactured',
    };
    return [{ component: component(v), label: v.label, color: v.color, requireSingleSolid: true }];
  }
  const open = state === 'open',
    unlocked = state === 'unlocked' || open,
    exploded = state === 'exploded';
  const source: ConfiguredPiece[] = pieces(p).map((v) => ({
    component: component({
      ...v,
      shape:
        unlocked && v.id === 'latch-slider'
          ? latchShape(p, latch.stroke)
          : open && (v.id === 'lid' || v.id.startsWith('lid-foam'))
            ? lidPoseShape(p, v.shape)
            : v.shape,
    }),
    label: v.label,
    color: v.color,
    requireSingleSolid: v.supply === 'manufactured',
  }));
  source.push(...hardware(p, unlocked ? latch.stroke : 0));
  return source.map((v) => {
    const id = v.component.id;
    const lidPart = id === 'lid' || id.startsWith('lid-foam');
    let position: [number, number, number] = [0, 0, 0];

    if (exploded) {
      if (lidPart) position = [0, 0, 65];
      else if (id === 'holder' || id.startsWith('cell-') || id.startsWith('holder-screw'))
        position = [0, 0, 25];
      else if (id === 'rear-tray' || id.startsWith('board-screw')) position = [0, 0, -35];
      else if (id === 'prepared-board' || id === 'balance-socket' || id.startsWith('holder-nut'))
        position = [0, 0, -15];
      else if (id === 'power-connector') position = [0, 0, 25];
    }
    return { ...v, position };
  });
}
