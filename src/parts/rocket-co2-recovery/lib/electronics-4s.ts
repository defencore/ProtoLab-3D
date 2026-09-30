import type { Parameters } from '../../../core/types';
import type { Piece } from './model';
import { groups, grouped } from './groups';
import {
  layout,
  ties,
  finderMounts,
  controllerCarrierGap,
  controllerCarrierThickness,
} from './layout';
import { spacers, mountedWing, wingMounts } from './electronics';
import { h7Mounts, mountedH7, h7MountScrew, h7BoardOffset } from './h7-controller';
import { metal, polymer, bore, axialScrew, at, hex, threadEntries } from './mechanical';
import { mountingHoles } from '../../lch7-controller/lib/model';
import { matingHole } from '../../rocket-release/lib/hardware';
import {
  box,
  circle,
  plate,
  ring,
  subtract,
  union,
  transform,
  type Shape,
} from '../../rocket-release/lib/shapes';

/** Identical screws and tapped clamp pattern for both replaceable controller disks. */
export function controllerCarrierScrew(p: Parameters, x: number, y: number): Shape {
  return axialScrew(2.5, 25, layout(p).controllerCarrierBottom - 0.5 + 25, x, y, true);
}

function controllerCarrier(p: Parameters): Piece[] {
  const v = layout(p),
    t = controllerCarrierThickness;
  const blank = plate(
    circle(31),
    [
      circle(4),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => circle(4, sx * 23, sy * 12))),
      ...h7Mounts.map(([x, y]) => circle(1.4, x, y)),
      ...(!v.h7 ? wingMounts(p).map(([x, y]) => circle(1.1, x, y)) : []),
    ],
    v.controllerCarrierBottom,
    t,
  );
  const out: Piece[] = [
    {
      label: `Flight-controller carrier disk · POM-C D62 t${t} · ${v.h7 ? 'LCH7 M2.5 through threads' : 'F405 damper D2.2 bores'} · five D8 wire ports`,
      material: 'POM-C',
      process: 'TURN / DRILL' + (v.h7 ? ' / TAP' : ''),
      color: polymer,
      shape: v.h7
        ? subtract(
            blank,
            ...mountingHoles.map(([x, y]) =>
              matingHole(h7MountScrew(v.controllerCarrierBottom, x, y, 20)),
            ),
            ...mountingHoles.map(([x, y]) =>
              threadEntries(2.5, 0.45, v.controllerCarrierBottom, t, x, y),
            ),
          )
        : blank,
      metadata: {
        Stock:
          'POM-C round bar or sheet: turn D62 and both faces to 6 mm, drill round holes; LCH7 version has four through-tapped M2.5x0.45 holes. No milling or printing is needed.',
        Interchange:
          'Common four D2.8 bores on the X/Y axes at R21.63747, four D6x10 metal spacers, M2.5x25 screws and M2.5 washers. Exchange only the controller disk and its controller-specific mounts; keep battery disks, cells, lamellas, spacers, tube and finder tray.',
        Wiring:
          'Five D8 round ports. Deburr edges and fit insulating sleeves to the actual wire bundle. Remove the disk for terminal service.',
        Retention:
          'The POM-C disk supports avionics only; the metal battery clamp carries cell impact loads. Limit screw torque to avoid plastic creep; verify tapped-hole stripping and shock retention on the actual material. PTFE is not a drop-in substitute for this threaded disk.',
      },
    },
  ];
  for (const [i, [x, y]] of h7Mounts.entries()) {
    out.push(
      {
        label: `Flight-controller carrier spacer ${i + 1} · Al6061 D6 / D2.8 through · L${controllerCarrierGap}`,
        shape: ring(3, 1.4, v.controllerCarrierTop, controllerCarrierGap, x, y),
        material: 'Al6061',
        process: 'TURN / DRILL',
        color: metal,
      },
      {
        label: `BUY controller carrier screw ${i + 1} · ISO 4762 M2.5x25 · compression disk through thread`,
        shape: controllerCarrierScrew(p, x, y),
        material: 'stainless steel',
        process: 'BUY',
        color: metal,
        metadata: {
          Engagement:
            'M2.5x0.45 through-tapped metal clamp with entry chamfers. Screw passes through a 0.5 mm washer, 6 mm controller disk and 10 mm D2.8 spacer. No blind bottom. Check thread stripping for the selected metal plate thickness.',
        },
      },
      {
        label: `BUY controller carrier washer ${i + 1} · M2.5 D5 / 2.7 t0.5`,
        shape: ring(2.5, 1.35, v.controllerCarrierBottom - 0.5, 0.5, x, y),
        material: 'stainless steel',
        process: 'BUY',
        color: metal,
      },
    );
  }
  return [
    ...out,
    ...(v.h7
      ? mountedH7(v.controllerCarrierBottom, mountingHoles, 20)
      : mountedWing(p, v.controllerCarrierBottom, t)),
  ];
}

export function electronics4s(p: Parameters): Piece[] {
  const v = layout(p),
    out: Piece[] = [];
  const mat = p.plateMaterial === 'steel' ? 'steel' : 'Al6061';
  const route = p.plateMaterial === 'steel' ? 'LASER CUT / DRILL / DEBURR' : 'TURN / DRILL';
  const add = (
    label: string,
    shape: Shape,
    material = mat,
    process = route,
    color = metal,
    metadata?: Record<string, string>,
  ) => out.push({ label, shape, material, process, color, metadata });
  const pilotR = 9.85,
    holeR = 10;
  const relief = [
    [31.5, 0],
    [-31.5, 0],
    [0, 31.5],
    [0, -31.5],
  ].map(([x, y]) => circle(5, x, y));
  const tieHoles = ties.map(([x, y]) => circle(2.2, x, y));
  add(
    `Battery foundation disk · ${mat} D83 t${v.t} · four D20 through insert seats · four D10 relief ports · D8 wire port`,
    plate(
      circle(41.5),
      [...tieHoles, ...relief, circle(4), ...v.cellPositions.map(([x, y]) => circle(holeR, x, y))],
      v.foundationBottom,
      v.t,
    ),
    mat,
    route,
    metal,
    {
      Placement:
        'Raised beyond the dispenser nut and nose anchor. Four 24.6 mm-pitch cells remain symmetric about the airframe axis. Socket shoulders carry load; nickel tabs do not.',
    },
  );
  add(
    `Battery compression disk · ${mat} D83 t${v.t} · four D20 seats · four M2.5x0.45 common carrier mounts`,
    subtract(
      plate(
        circle(41.5),
        [
          ...tieHoles,
          ...relief,
          circle(4),
          circle(1.1, -6, 0),
          circle(1.1, 6, 0),
          ...v.cellPositions.map(([x, y]) => circle(holeR, x, y)),
          ...finderMounts(p).map(([x, y]) => circle(1.65, x, y)),
        ],
        v.clampBottom,
        v.t,
      ),
      ...h7Mounts.map(([x, y]) => matingHole(controllerCarrierScrew(p, x, y))),
      ...h7Mounts.map(([x, y]) => threadEntries(2.5, 0.45, v.clampBottom, v.t, x, y)),
    ),
    mat,
    p.plateMaterial === 'steel' ? 'LASER CUT / DRILL / TAP / DEBURR' : 'TURN / DRILL / TAP',
  );
  out.push(...spacers(p, v.foundationTop, v.foundationBottom));
  const seatR = v.cell.diameter / 2 + 0.25;
  for (const [row, y] of [-12.3, 12.3].entries()) {
    const seats = [-12.3, 12.3].map((x) =>
      subtract(
        union(
          bore(11.5, v.cellTop - 4, 6.25, x, y),
          bore(pilotR, v.foundationBottom - 0.1, v.t + 0.9, x, y),
        ),
        bore(seatR, v.cellTop - 4.1, 4.1, x, y),
      ),
    );
    // A continuous backing against the foundation supports the entire nickel
    // link. The open channel accepts the preformed link before cell insertion.
    const cradle = subtract(
      union(...seats, box([24.6, 5, 2.05], [-12.3, y - 2.5, v.cellTop + 0.2])),
      box([30, 4.4, 0.3], [-15, y - 2.2, v.cellTop - 0.05]),
    );
    const node = row === 0 ? 'B1' : 'B3';
    add(
      `4S supported insulating bridge ${row + 1} · PA12 · two D23 shoulders / D19.7 pilots · open ${node} channel`,
      cradle,
      'PA12',
      '3D PRINT',
      polymer,
      {
        Retention:
          'Two D19.7 pilots pass through D20 foundation seats with 0.8 mm visible end projection; the entire bridge and both shoulders are backed by metal.',
        Electrical:
          'Lay the nickel link in its open channel before installing the cells. Conductive parts do not enter the metal sockets.',
      },
    );
    add(
      `4S series link ${node} · nickel 29.6x4 t0.2 · supported cell terminals`,
      box([29.6, 4, 0.2], [-14.8, y - 2, v.cellTop]),
      'Ni200',
      'FORM / SPOT WELD',
      0xb99450,
      {
        ElectricalNode: node,
        Connection: row === 0 ? 'C1 positive to C2 negative' : 'C3 positive to C4 negative',
      },
    );
  }
  const midTabs: Shape[] = [];
  for (const [i, [x, y]] of v.cellPositions.entries()) {
    const place = (s: Shape) => transform(s, x < 0 ? 0 : 180, [x, y, 0]);
    const far = subtract(
      union(bore(11.5, v.clampTop, 8), bore(pilotR, v.clampBottom - 3, v.t + 3.1)),
      bore(seatR, v.cellBottom, 6.1),
      bore(4.5, v.clampBottom - 0.8, v.cellBottom - v.clampBottom + 0.9),
      bore(4.5, v.clampBottom - 3.1, 1.5),
      box([11.2, 4.8, v.cellBottom - v.clampBottom + 3.2], [-12, -2.4, v.clampBottom - 3.1]),
      box([12, 4.8, 1.5], [0, -2.4, v.clampBottom - 3.1]),
    );
    add(
      `Cell ${i + 1} outer insulating seat · PA12 D23 shoulder / D19.7 pilot · open contact slot`,
      place(far),
      'PA12',
      '3D PRINT',
      polymer,
      {
        Retention:
          'D23 shoulder bears on the compression disk; D19.7 pilot passes through D20. One insertion flange only. Lay tabs into the open slot.',
        Electrical: 'Recessed output pad has a 0.8 mm PA12 backing and an open inward wire exit.',
      },
    );
    const terminal = union(
      box([5, 4, 0.2], [-2.5, -2, v.cellBottom - 0.2]),
      box([0.2, 4, v.cellBottom - v.outputPadZ], [-1.2, -2, v.outputPadZ]),
      box([5.2, 4, 0.2], [-1.6, -2, v.outputPadZ]),
    );
    if (i === 1 || i === 2) {
      midTabs.push(place(terminal));
      continue;
    }
    const node = i === 0 ? 'B-' : 'B+';
    add(
      `Cell ${i + 1} fixed output · ${node} · formed nickel t0.2`,
      place(terminal),
      'Ni200',
      'FORM / SPOT WELD',
      i === 3 ? 0xbc574b : 0x58616e,
      {
        ElectricalNode: node,
        Service:
          'Form and solder leads before spot welding tabs to cells. Five distinct balance nodes B-, B1, B2, B3, B+; wire protection and current rating must match actual loads.',
      },
    );
  }
  // A formed nickel strip connects C2+/C3-. Its insulating carrier is fitted
  // after the compression disk, so it does not trap the four single-flange seats.
  const strip = (width: number, z: number, h: number) =>
    union(
      box([12.3 + width, width, h], [-width / 2, -12.3 - width / 2, z]),
      box([width, 24.6 + width, h], [-width / 2, -12.3 - width / 2, z]),
      box([12.3 + width, width, h], [-width / 2, 12.3 - width / 2, z]),
    );
  const carrierBottom = v.outputPadZ + 0.2;
  const carrier = subtract(
    union(strip(6, carrierBottom, 1.6), box([22, 6, 1.6], [-11, -3, carrierBottom])),
    ...v.cellPositions.map(([x, y]) => bore(pilotR + 0.1, carrierBottom - 0.1, 1.8, x, y)),
    ...[-6, 6].map((x) => bore(1.1, carrierBottom - 0.1, 1.8, x, 0)),
  );
  add(
    '4S B2 lamella backing · PA12 · clamp-backed open carrier · two M2 through fixings',
    carrier,
    'PA12',
    '3D PRINT',
    polymer,
    {
      Retention:
        'Fit after inserting the seats and clamp. Two M2 through-bolts and nuts retain the carrier; its flat rear face bears against the metal disk. Nickel is continuously supported by this carrier or the terminal seat floors.',
      Electrical:
        'Open channel for a single formed B2 nickel strip. Fixing holes lie on separate ears, clear of the conductor.',
    },
  );
  add(
    '4S formed B2 lamella · nickel w4 t0.2 · integral C2 positive / C3 negative tabs',
    union(strip(4, v.outputPadZ, 0.2), ...midTabs),
    'Ni200',
    'FORM / SPOT WELD',
    0xb99450,
    {
      ElectricalNode: 'B2',
      Connection:
        'Single continuous formed nickel part connects C2+ to C3-. All three series connections use lamellas; power and balance leads are separate. Select strip thickness/width for measured current; not a qualified current rating.',
    },
  );
  [-6, 6].forEach((x, i) => {
    const screw = axialScrew(2, 8, v.clampTop - 8, x, 0);
    add(`BUY B2 carrier screw ${i + 1} · ISO 4762 M2x8`, screw, 'stainless steel', 'BUY');
    add(
      `BUY B2 carrier nut ${i + 1} · ISO 4032 M2x0.4 AF4 h1.6`,
      subtract(at(hex(4, carrierBottom - 1.6, 1.6), x, 0), matingHole(screw)),
      'stainless steel',
      'BUY',
    );
  });
  out.push(...grouped(controllerCarrier(p), groups.controller));
  if (!v.h7) return out;
  out.push({
    group: groups.controller,
    label: 'BUY LCH7 v3.2 · 50.97594x44x7.48268 · measured PCB / lightweight components',
    material: 'electronic assembly',
    process: 'BUY',
    color: 0x244f41,
    library: {
      kind: 'module',
      model: 'lch7-v3-2',
      offset: [0, 0, v.controllerCarrierBottom - h7BoardOffset + 3.1],
      inverted: true,
      azimuth: 0,
    },
    metadata: {
      Library: 'lch7-controller',
      Mounting:
        'FR4 controller assembly on silicone grommets and metal compression limiters; verify fits on purchased hardware.',
    },
  });
  return out;
}
