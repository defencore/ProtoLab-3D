import type { Parameters } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
import { detailComponent } from '../../../core/component-recipes';
import { n } from '../../../core/geometry';
import {
  cylinder,
  box,
  prism,
  union,
  subtract,
  type Shape,
} from '../../../core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { layout, bearingSource, mr93Source } from './selection';

export interface JigPiece {
  id: string;
  label: string;
  shape: Shape;
  color: number;
  supply: 'manufactured' | 'purchased';
  designation?: string;
  source?: string;
}
const radial = (diameter: number, from: number, to: number, tangent = 0, z = 0): Shape =>
  cylinder(diameter / 2, to - from, [from, tangent, z], 'x');
const block = (from: number, to: number, width: number, height: number, z = 0): Shape =>
  box([to - from, width, height], [from, -width / 2, z - height / 2]);
const place = (shape: Shape, angle: number, z: number): Shape => ({
  kind: 'transform',
  child: shape,
  rotation: [0, 0, angle],
  translation: [0, 0, z],
});
const hex = (af: number, length: number, from: number): Shape => {
  const points: [number, number][] = Array.from({ length: 6 }, (_, i) => {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    return [(af / Math.sqrt(3)) * Math.cos(a), (af / Math.sqrt(3)) * Math.sin(a)];
  });
  return {
    kind: 'transform',
    child: prism(points, length, from),
    rotation: [0, 90, 0],
    translation: [0, 0, 0],
  };
};
/** Circular running envelope with a 45-degree roof, in the local X direction. */
const roofed = (diameter: number, from: number, to: number): Shape => {
  const r = diameter / 2,
    q = r / Math.sqrt(2);
  return union(radial(diameter, from, to), {
    kind: 'loft',
    rings: [from, to].map((x): [number, number, number][] => [
      [x, -q, q],
      [x, q, q],
      [x, 0, r * Math.sqrt(2)],
    ]),
  });
};
const axialProfile = (profile: [number, number][]): Shape => ({
  kind: 'transform',
  child: { kind: 'revolve', profile },
  rotation: [0, 90, 0],
  translation: [0, 0, 0],
});

/** One through-bore body, a removable end stop and one self-contained movable guide. */
export function jigPieces(p: Parameters): JigPiece[] {
  const d = layout(p),
    H = d.axisHeight,
    bottom = n(p, 'stopThickness');
  const out: JigPiece[] = [];
  const add = (
    id: string,
    label: string,
    shape: Shape,
    color: number,
    supply: JigPiece['supply'] = 'manufactured',
    designation?: string,
    source?: string,
  ) => out.push({ id, label, shape, color, supply, designation, source });
  const pilot = d.bodyBore - 0.3;
  const bodyCuts: Shape[] = [
    cylinder(d.bodyBore / 2, d.headSeat - d.bodyBottom + 2, [0, 0, d.bodyBottom - 1]),
    // Open-up 45-degree mouth supports the hanging liner even with the stop removed.
    {
      kind: 'revolve',
      profile: [
        [0, d.headSeat - 2.85],
        [d.bodyBore / 2, d.headSeat - 2.85],
        [pilot / 2 + 3, d.headSeat],
        [0, d.headSeat],
      ],
    },
  ];
  const headCuts: Shape[] = [cylinder(d.bore / 2, d.top + 2, [0, 0, -1])];
  const alignmentCuts: Shape[] = [];
  for (const angle of d.mountAngles) {
    const a = (angle * Math.PI) / 180,
      x = d.mountRadius * Math.cos(a),
      y = d.mountRadius * Math.sin(a);
    bodyCuts.push(cylinder(1.65, 8.1, [x, y, d.headSeat - 8]));
    headCuts.push(
      cylinder(2.2, d.top - d.headSeat + 2, [x, y, d.headSeat - 1]),
      cylinder(4, 5.1, [x, y, d.top - 5]),
    );
    if (angle === 15 || angle === 195) {
      // Separate tubular keys register all three plates and print on their ends.
      alignmentCuts.push(cylinder(4.2, 27.2, [x, y, H - 3]));
      alignmentCuts.push({
        kind: 'transform',
        child: {
          kind: 'revolve',
          profile: [
            [0, H + 24.2],
            [4.2, H + 24.2],
            [2.2, H + 26.2],
            [0, H + 26.2],
          ],
        },
        rotation: [0, 0, 0],
        translation: [x, y, 0],
      });
      add(
        `alignment-bush-${angle}`,
        'Head alignment bush / 8 x 4.4 x 27 mm',
        subtract(cylinder(4, 27, [x, y, H - 3]), cylinder(2.2, 27.2, [x, y, H - 3.1])),
        0x397587,
      );
    }
    add(
      `head-screw-${angle}`,
      'M4 indexing-head attachment screw',
      union(
        cylinder(2, d.top - 5 - d.headSeat + 7, [x, y, d.headSeat - 7]),
        cylinder(3.5, 3.5, [x, y, d.top - 5]),
      ),
      0x727c89,
      'purchased',
      'M4 socket-head screw / select length for 7 mm engagement in qualified printed pilot',
    );
  }
  // All empty sockets are inexpensive printed features. Only the selected one holds a cassette.
  for (const { angle } of d.stations) {
    headCuts.push(
      place(radial(d.barrelOD + n(p, 'cartridgeClearance'), d.socketStart, d.radius + 1), angle, H),
      // Narrow passage opens the nose-to-tube gap without removing the full socket web.
      place(
        radial(d.drill + n(p, 'guideClearance') + 0.6, n(p, 'tubeOD') / 2 - 1, d.start + 0.1),
        angle,
        H,
      ),
      place(
        radial(d.flangeWidth + n(p, 'cartridgeClearance'), d.flangeStart, d.radius + 1),
        angle,
        H,
      ),
    );
    const a = (angle * Math.PI) / 180,
      r = d.lockRadius;
    const xy = [
      r * Math.cos(a) - d.lockOffset * Math.sin(a),
      r * Math.sin(a) + d.lockOffset * Math.cos(a),
    ];
    // Only the normal-printed crown is threaded; the other plate is clearance.
    headCuts.push(
      cylinder(2.2, d.crownBase - H - d.lockFloor, [xy[0], xy[1], H + d.lockFloor]),
      cylinder(1.65, d.top - d.crownBase + 1, [xy[0], xy[1], d.crownBase]),
    );
  }
  // Top-loaded keyed pads cannot rotate or pass through the narrower inner window.
  for (const [i, angle] of [0, 120, 240].entries()) {
    const inner = n(p, 'tubeOD') / 2 + 0.05,
      padEnd = inner + 4;
    headCuts.push(
      place(block(inner - 1, inner + 2, 10.4, 12, d.crownBase - H + 9.2), angle, H),
      place(block(inner + 1.8, padEnd + 0.3, 14.4, 12, d.crownBase - H + 9.2), angle, H),
      place(roofed(5.5, padEnd - 0.1, d.radius + 1), angle, d.clampZ),
      place(roofed(10, d.radius - 6, d.radius + 1), angle, d.clampZ),
      place(block(d.radius - 13.2, d.radius - 8.8, 9.5, 12, d.crownBase - H + 9.2), angle, H),
    );
    const pad = union(
      block(inner, inner + 2.1, 10, 8, d.clampZ - H),
      block(inner + 2, padEnd, 14, 8, d.clampZ - H),
    );
    add(`clamp-pad-${i + 1}`, 'Captive tube pressure pad', place(pad, angle, H), 0x397587);
    add(
      `clamp-nut-${i + 1}`,
      'M5 captive hex nut',
      place(
        subtract(hex(8, 4, d.radius - 13), radial(5, d.radius - 13.1, d.radius - 8.9)),
        angle,
        d.clampZ,
      ),
      0xb8bdc4,
      'purchased',
      'M5 hex nut / 8 mm across flats / nominal 4 mm thick',
    );
    add(
      `clamp-screw-${i + 1}`,
      'M5 tube clamp screw / recessed head',
      place(
        union(radial(5, padEnd, d.radius - 6), radial(8.5, d.radius - 6, d.radius - 1.5)),
        angle,
        d.clampZ,
      ),
      0x727c89,
      'purchased',
      `M5 socket-head clamp screw / nominal reach ${(d.radius - 6 - padEnd).toFixed(1)} mm; fit a measured-length screw`,
    );
  }
  const stopCuts: Shape[] = [cylinder(4, bottom + 6, [0, 0, d.bodyBottom - bottom - 1])];
  for (const angle of d.stopMountAngles) {
    const a = (angle * Math.PI) / 180;
    const x = d.stopMountRadius * Math.cos(a),
      y = d.stopMountRadius * Math.sin(a);
    bodyCuts.push(cylinder(1.65, 9, [x, y, d.bodyBottom]));
    const base = d.bodyBottom - bottom;
    stopCuts.push(cylinder(2.2, bottom + 0.2, [x, y, base - 0.1]), {
      kind: 'transform',
      rotation: [0, 0, 0],
      translation: [x, y, 0],
      child: {
        kind: 'revolve',
        profile: [
          [0, base - 0.1],
          [4.2, base - 0.1],
          [4.2, base],
          [2.2, base + 2],
          [0, base + 2],
        ],
      },
    });
    if (d.endStop)
      add(
        `stop-screw-${angle}`,
        'M4 countersunk removable stop screw',
        {
          kind: 'transform',
          rotation: [0, 0, 0],
          translation: [x, y, 0],
          child: {
            kind: 'revolve',
            profile: [
              [0, base],
              [4, base],
              [2, base + 2],
              [2, d.bodyBottom + 7],
              [0, d.bodyBottom + 7],
            ],
          },
        },
        0x727c89,
        'purchased',
        `M4 countersunk screw / ${d.stopScrewLength} mm total length / 7 mm printed pilot engagement; default M4 x 12`,
      );
  }
  add(
    'collar',
    `Through-bore body / capacity ${d.capacity} mm / datum H=${H} mm`,
    subtract(prism(d.outline, d.headSeat - d.bodyBottom, d.bodyBottom), ...bodyCuts),
    0xe9ac45,
  );
  if (d.endStop)
    add(
      'stop-plate',
      'Removable tube end stop / flat base and locating boss',
      subtract(
        union(
          prism(d.outline, bottom, d.bodyBottom - bottom),
          cylinder(pilot / 2, -d.bodyBottom, [0, 0, d.bodyBottom]),
        ),
        ...stopCuts,
      ),
      0xe9ac45,
    );
  const liner: Shape = {
    kind: 'revolve',
    profile: [
      [d.bore / 2, 0.2],
      [pilot / 2, 0.2],
      [pilot / 2, d.headSeat - 3],
      [pilot / 2 + 3, d.headSeat],
      [d.bore / 2 + d.linerWidth, d.headSeat],
      [d.bore / 2 + 1.2, d.headSeat + d.linerWidth - 1.2],
      [d.bore / 2, d.headSeat + d.linerWidth - 1.2],
    ],
  };
  add(
    'centering-liner',
    `Centering liner / tube ${p.tubeOD} mm / tapered register`,
    liner,
    0x83a5ae,
  );
  const registerCut: Shape = {
    kind: 'revolve',
    profile: [
      [0, d.headSeat - 0.1],
      [d.bore / 2 + d.linerWidth + 0.3, d.headSeat - 0.1],
      [d.bore / 2, d.headSeat + d.linerWidth + 0.2],
      [0, d.headSeat + d.linerWidth + 0.2],
    ],
  };
  for (const [id, label, from, to, color] of [
    ['index-lower', 'Lower indexing saddle / grooves up', d.headSeat, H, 0x8198ab],
    ['index-upper', 'Upper indexing plate / print inverted', H, d.crownBase, 0xb8c5cf],
    ['clamp-crown', 'Tube clamp crown / slots up', d.crownBase, d.top, 0xd8dfe4],
  ] as const)
    add(
      id,
      `${label} / tube ${p.tubeOD} mm / ${d.count} positions`,
      subtract(
        prism(d.outline, to - from, from),
        ...headCuts,
        ...alignmentCuts,
        ...(id === 'index-lower' ? [registerCut] : []),
      ),
      color,
    );

  const seat = d.outer + n(p, 'seatClearance');
  const relief =
    d.kind === 'bearing'
      ? d.drill + (d.outer - d.drill) * 0.75
      : d.drill + n(p, 'guideClearance') + 0.6;
  const screwTools = [-1, 1].map((sign) =>
    radial(2.5, d.flangeEnd - 7, d.flangeEnd + 0.1, sign * d.screwOffset),
  );
  const seatFrom = d.kind === 'bearing' ? d.start + 1.2 : d.flangeEnd - d.width;
  const cartridge = subtract(
    union(
      radial(d.barrelOD, d.start, d.flangeEnd),
      radial(d.flangeWidth, d.flangeStart, d.flangeEnd),
    ),
    radial(
      d.kind === 'plain' ? d.drill + n(p, 'guideClearance') : relief,
      d.start - 0.1,
      d.flangeEnd + 0.1,
    ),
    ...(d.kind === 'plain' ? [] : [radial(seat, seatFrom, d.flangeEnd + 0.1)]),
    ...(d.kind === 'plain' ? [] : screwTools),
    // Shallow top landing for the cassette lock; the flange is the radial datum.
    prism(
      [
        [d.lockRadius + 2, d.lockFloor],
        [d.lockRadius - 2, d.lockFloor],
        [d.lockRadius - 6, d.lockFloor + 4],
        [d.lockRadius + 2, d.lockFloor + 4],
      ],
      4.4,
      d.lockOffset - 2.2,
      'y',
    ),
  );
  add(
    'cartridge-1',
    'Movable guide cassette / transfer to each station',
    place(cartridge, d.active.angle, H),
    0x316ce8,
  );
  if (d.kind !== 'plain') {
    const cap = subtract(
      radial(d.flangeWidth, d.capStart, d.capEnd),
      radial(relief, d.capStart - 0.1, d.capEnd + 0.1),
      ...[-1, 1].map((sign) => radial(3.4, d.capStart - 0.1, d.capEnd + 0.1, sign * d.screwOffset)),
    );
    add(
      'retainer-1',
      'Cassette outer retainer / travels with both guides',
      place(cap, d.active.angle, H),
      0x26354c,
    );
    if (d.kind === 'bearing') {
      const from = d.bearingStarts[0] + d.width,
        to = d.bearingStarts[1];
      const running = d.drill + n(p, 'guideClearance') + 0.6;
      const taper = (relief - running) / 2;
      add(
        'bearing-spacer',
        'Cassette outer-race distance sleeve',
        place(
          axialProfile([
            [relief / 2, from],
            [(d.outer - 0.15) / 2, from],
            [(d.outer - 0.15) / 2, to],
            [relief / 2, to],
            [running / 2, to - taper],
            [running / 2, from + taper],
          ]),
          d.active.angle,
          H,
        ),
        0x83a5ae,
      );
    }
    const starts = d.kind === 'bearing' ? d.bearingStarts : [d.flangeEnd - d.width];
    starts.forEach((from, i) => {
      const designation = d.bearing
        ? `${d.bearing.id} / ${d.drill} x ${d.outer} x ${d.width} mm`
        : `Custom hardened drill bushing / ID ${d.drill + n(p, 'guideClearance')} x OD ${d.outer} x L ${d.width} mm`;
      add(
        `guide-1-${i + 1}`,
        designation,
        place(
          subtract(
            radial(d.outer, from, from + d.width),
            radial(
              d.bearing ? d.drill : d.drill + n(p, 'guideClearance'),
              from - 0.1,
              from + d.width + 0.1,
            ),
          ),
          d.active.angle,
          H,
        ),
        0xc5cad1,
        'purchased',
        designation,
        d.bearing ? (d.drill === 3 ? mr93Source : bearingSource) : undefined,
      );
    });
    for (const sign of [-1, 1])
      add(
        `screw-1-${sign}`,
        'M3 cassette retainer screw',
        place(
          union(
            radial(3, d.capEnd - 10, d.capEnd, sign * d.screwOffset),
            radial(5.5, d.capEnd, d.capEnd + 1.5, sign * d.screwOffset),
          ),
          d.active.angle,
          H,
        ),
        0x727c89,
        'purchased',
        'M3 low-head screw / nominal 10 mm under head / qualify printed 2.5 mm pilot',
      );
  }
  const a = (d.active.angle * Math.PI) / 180,
    lockR = d.lockRadius;
  add(
    'cassette-lock',
    'M4 cassette lock / loosen only when moving guide',
    union(
      cylinder(2, d.top - H - d.lockFloor, [
        lockR * Math.cos(a) - d.lockOffset * Math.sin(a),
        lockR * Math.sin(a) + d.lockOffset * Math.cos(a),
        H + d.lockFloor,
      ]),
      cylinder(3.5, 3.5, [
        lockR * Math.cos(a) - d.lockOffset * Math.sin(a),
        lockR * Math.sin(a) + d.lockOffset * Math.cos(a),
        d.top,
      ]),
    ),
    0x727c89,
    'purchased',
    'M4 cassette lock screw / measured length / printed 3.3 mm pilot',
  );
  let spacerZ = d.endStop ? 0 : d.bodyBottom - 40;
  for (const [i, thickness] of d.stack.entries()) {
    add(
      `spacer-${i + 1}`,
      `Tube end height spacer ${thickness} mm`,
      subtract(
        cylinder(d.spacerOD / 2, thickness, [0, 0, spacerZ]),
        cylinder(d.stopBore / 2, thickness + 2, [0, 0, spacerZ - 1]),
      ),
      i % 2 ? 0x537a8a : 0x83a5ae,
    );
    spacerZ += thickness;
  }
  if (p.showTube)
    add(
      'workpiece',
      'Reference tube / remove from print export',
      subtract(
        cylinder(n(p, 'tubeOD') / 2, d.top + 12 - spacerZ, [0, 0, spacerZ]),
        cylinder(n(p, 'tubeOD') / 2 - n(p, 'tubeWall'), d.top + 14 - spacerZ, [0, 0, spacerZ - 1]),
      ),
      0x747d89,
      'purchased',
      `Workpiece tube / OD ${p.tubeOD} x wall ${p.tubeWall} mm`,
    );
  return out.sort((a, b) => (a.id === 'collar' ? -1 : b.id === 'collar' ? 1 : 0));
}

/** Flat, spaced fabrication poses. This is a parts layout, not a fixed printer bed size. */
export function printLayout(p: Parameters): JigPiece[] {
  const d = layout(p),
    gap = 8;
  const posed = jigPieces(p)
    .filter((piece) => piece.supply === 'manufactured')
    .map((piece) => {
      let shape = piece.shape,
        width = 2 * d.radius,
        depth = width;
      let rotation: [number, number, number] = [0, 0, 0];
      let offset: [number, number, number] = [0, 0, 0];
      if (piece.id === 'collar') offset[2] = -d.bodyBottom;
      else if (piece.id === 'stop-plate') offset[2] = n(p, 'stopThickness') - d.bodyBottom;
      else if (piece.id === 'index-lower') offset[2] = -d.headSeat;
      else if (piece.id === 'index-upper') {
        rotation = [180, 0, 0];
        offset[2] = d.crownBase;
      } else if (piece.id === 'clamp-crown') offset[2] = -d.crownBase;
      else if (piece.id === 'centering-liner') {
        offset[2] = -0.2;
        width = depth = d.bodyBore + 5.7;
      } else if (piece.id.startsWith('alignment-bush-')) {
        const angle = (Number(piece.id.split('-').at(-1)) * Math.PI) / 180;
        offset = [
          -d.mountRadius * Math.cos(angle),
          -d.mountRadius * Math.sin(angle),
          3 - d.axisHeight,
        ];
        width = depth = 8;
      } else if (piece.id.startsWith('clamp-pad-')) {
        const angle = (Number(piece.id.split('-').at(-1)) - 1) * 120;
        shape = place(shape, -angle, -d.axisHeight);
        rotation = [0, 90, 0];
        offset = [-(d.clampZ - d.axisHeight), 0, n(p, 'tubeOD') / 2 + 4.05];
        width = 8;
        depth = 14;
      } else if (piece.id.startsWith('spacer-')) {
        const i = Number(piece.id.split('-').at(-1)) - 1;
        offset[2] = -d.stack.slice(0, i).reduce((sum, v) => sum + v, 0);
        width = depth = d.spacerOD;
      } else {
        shape = place(shape, -d.active.angle, -d.axisHeight);
        if (piece.id === 'cartridge-1') {
          rotation = [0, 90, 0];
          offset[2] = d.flangeEnd;
          width = depth = d.flangeWidth;
        } else if (piece.id === 'retainer-1') {
          rotation = [0, -90, 0];
          offset[2] = -d.capStart;
          width = depth = d.flangeWidth;
        } else if (piece.id === 'bearing-spacer') {
          rotation = [0, -90, 0];
          offset[2] = -(d.bearingStarts[0] + d.width);
          width = depth = d.outer - 0.15;
        } else throw new Error('Missing print orientation for ' + piece.id);
      }
      return { piece, shape, width, depth, rotation, offset };
    })
    .sort((a, b) => b.width * b.depth - a.width * a.depth);
  const rowWidth = 6 * d.radius + 2 * gap;
  let x = 0,
    y = 0,
    rowDepth = 0;
  return posed.map(({ piece, shape, width, depth, rotation, offset }) => {
    if (x > 0 && x + width > rowWidth + 1e-6) {
      x = 0;
      y += rowDepth + gap;
      rowDepth = 0;
    }
    const translation: [number, number, number] = [
      x + width / 2 + offset[0],
      y + depth / 2 + offset[1],
      offset[2],
    ];
    x += width + gap;
    rowDepth = Math.max(rowDepth, depth);
    return { ...piece, shape: { kind: 'transform', child: shape, rotation, translation } };
  });
}

function component(piece: JigPiece): AssemblyComponent {
  const item = detailComponent(piece.id, piece.label, piece.shape);
  if (piece.supply === 'manufactured') {
    const isSpacer = piece.id.startsWith('spacer-');
    item.manufacturing = {
      material: isSpacer
        ? 'Measured spacer stock or calibrated PETG'
        : 'PETG or PA / qualify actual print',
      blank: isSpacer ? 'Annular spacer / measured parallel faces' : 'FDM print',
      processes: isSpacer ? ['cutting', 'printing'] : ['printing'],
      requirements: [
        isSpacer
          ? 'Measure thickness and face parallelism; measured stack sets end offset.'
          : 'Use the Print layout orientation: lower grooves up, upper plate inverted, crown slots up, cassette flange down, retainer flat face down. Test guide and tube fits first.',
      ],
    };
  } else {
    item.libraryId = 'purchased-component';
    item.supply = 'purchased';
    item.procurement = {
      designation: piece.designation!,
      manufacturer: '',
      source: piece.source ?? 'Supplier to be selected / nominal envelope',
    };
  }
  return item;
}
export function jigComposition(p: Parameters): AssemblyDefinition {
  return {
    components: jigPieces(p).map(component),
    issues: [
      'Clamp and seat the tube before the first hole. Keep all three tube clamps tight while withdrawing and moving the single cassette. Hold the fixture in a vise or clamp it to the table.',
      'Use the separate tapered centering liner, two indexing plates and clamp crown. Two tubular alignment keys register the plates; four M4 attachment screws clamp them to the common cup.',
      'Both bearings travel together: integrated inner lip, outer-race sleeve and screwed outer retainer. The flange shoulder sets insertion depth; the M4 lock prevents withdrawal.',
      'Measure the reusable 0.5/1/2/5/10/20 mm stop rings. End offset equals fixed axis height minus the measured spacer stack. Fully withdraw the bit before relocating the cassette.',
      'Bearing bores are nominal, not drill-bushing tolerances. Verify free passage, actual race clearance and sufficient exposed drill length; qualify polymer threads and clamp torque.',
    ],
  };
}
export function configuredPieces(p: Parameters, state: string): ConfiguredPiece[] {
  if (state === 'print-layout')
    return printLayout(p).map((piece) => ({
      component: component(piece),
      label: piece.label,
      color: piece.color,
      requireSingleSolid: true,
    }));
  const d = layout(p),
    exploded = state === 'exploded',
    a = (d.active.angle * Math.PI) / 180;
  return jigPieces(p).map((piece) => {
    const cassette = /^(cartridge|retainer|guide|screw)-|^bearing-spacer$|^cassette-lock$/.test(
      piece.id,
    );
    const dist =
      piece.id === 'cartridge-1'
        ? 25
        : piece.id === 'bearing-spacer'
          ? 40
          : piece.id.startsWith('guide-')
            ? 55
            : 70;
    return {
      component: component(piece),
      label: piece.label,
      color: piece.color,
      requireSingleSolid: true,
      position: !exploded
        ? [0, 0, 0]
        : cassette
          ? [dist * Math.cos(a), dist * Math.sin(a), 0]
          : piece.id === 'index-lower'
            ? [0, 0, 20]
            : piece.id === 'index-upper'
              ? [0, 0, 45]
              : piece.id === 'clamp-crown' ||
                  piece.id.startsWith('head-screw') ||
                  piece.id.startsWith('clamp-')
                ? [0, 0, 70]
                : piece.id === 'centering-liner'
                  ? [0, 0, 8]
                  : piece.id === 'stop-plate' || piece.id.startsWith('stop-screw-')
                    ? [0, 0, -20]
                    : piece.id.startsWith('alignment-bush-')
                      ? [0, 0, 35]
                      : piece.id === 'workpiece'
                        ? [0, 0, 85]
                        : piece.id.startsWith('spacer-')
                          ? [-2 * d.radius - 15, 0, 0]
                          : [0, 0, 0],
    };
  });
}
