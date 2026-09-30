import type { Parameters } from '../../../core/types';
import type { Piece } from './model';
import { groups } from './groups';
import {
  layout,
  ties,
  finderMounts,
  electronicsMount,
  electronicsMountPenetration,
} from './layout';
import {
  metal,
  polymer,
  bore,
  at,
  axialScrew,
  blindTapDimensions,
  blindTap,
  blindTapNote,
  turnedStud,
} from './mechanical';
import {
  box,
  circle,
  plate,
  ring,
  subtract,
  union,
  transform,
  rotate,
  type Shape,
} from '../../rocket-release/lib/shapes';
import { controllerPieces } from '../../rocket-release/lib/wing-controller';
import { defaults as releaseDefaults } from '../../rocket-release/configurator';
export function electronics(p: Parameters): Piece[] {
  const v = layout(p),
    out: Piece[] = [];
  const route = p.plateMaterial === 'steel' ? 'LASER CUT / DEBURR' : 'TURN / DRILL';
  const mat = p.plateMaterial === 'steel' ? 'steel' : 'Al6061';
  const add = (
    label: string,
    shape: Shape,
    material = mat,
    process = route,
    color = metal,
    metadata?: Record<string, string>,
    group: readonly string[] = groups.battery,
  ) => out.push({ label, shape, material, process, color, metadata, group });
  const tieHoles = ties.map(([x, y]) => circle(2.2, x, y));
  const lightening = [circle(6, 0, -29), circle(6, 0, 29)];
  const fcMounts = wingMounts(p);
  const fcHoles = fcMounts.map(([x, y]) => circle(1.1, x, y));
  add(
    `Flight-controller carrier disk · ${mat} D83 t${v.t} · two D21 cell clearances · round wire ports`,
    plate(
      circle(41.5),
      [
        ...tieHoles,
        ...fcHoles,
        circle(10.5, -v.cellX, 0),
        circle(10.5, v.cellX, 0),
        ...lightening,
        circle(5),
      ],
      v.controllerPlateBottom,
      v.t,
    ),
    mat,
    route,
    metal,
    undefined,
    groups.controller,
  );
  add(
    `Battery compression disk · ${mat} D83 t${v.t} · two D13 insert bores · closed load-bearing rings`,
    plate(
      circle(41.5),
      [
        ...tieHoles,
        ...finderMounts(p).map(([x, y]) => circle(1.65, x, y)),
        ...lightening,
        circle(7),
        circle(v.insertHoleRadius, -v.cellX, 0),
        circle(v.insertHoleRadius, v.cellX, 0),
        circle(2.5, -12, -13),
        circle(2.5, 12, 13),
      ],
      v.clampBottom,
      v.t,
    ),
  );
  out.push(...spacers(p, v.controllerPlateTop, v.controllerPlateBottom));
  const nearSeats: Shape[] = [],
    nearTabs: Shape[] = [];
  for (const [i, x] of [-v.cellX, v.cellX].entries()) {
    // Like the library MG996R 2S pack, metal shoulders take the axial load,
    // pilots locate the insulators and separate open slots carry the contacts.
    const seatR = v.cell.diameter / 2 + 0.25;
    const near = subtract(
      union(
        bore(11.5, v.cellTop - 4, -v.cellTop + 4),
        bore(v.insertPilotRadius, -0.1, v.bulkheadPilotHeight + 0.1),
      ),
      bore(seatR, v.cellTop - 4.1, 4.1),
      box([14, 5, 0.6], [-2.5, -2.5, v.cellTop - 0.05]),
    );
    // One insertion flange only: the complete D12.7 pilot and its protected pad
    // pass through the D13 disk bore. No impossible flange on the opposite face.
    const far = subtract(
      union(bore(11.5, v.clampTop, 8), bore(v.insertPilotRadius, v.clampBottom - 3, v.t + 3.1)),
      bore(seatR, v.cellBottom, 6.1),
      bore(4.5, v.clampBottom - 0.8, v.cellBottom - v.clampBottom + 0.9),
      bore(4.5, v.clampBottom - 3.1, 1.5),
      // Open outward to lay in the preformed welded tab before inserting the cell.
      box([11.2, 4.8, v.cellBottom - v.clampBottom + 3.2], [-12, -2.4, v.clampBottom - 3.1]),
      // The lead leaves the recessed pad inward, entirely below the metal face.
      box([8, 4.8, 1.5], [0, -2.4, v.clampBottom - 3.1]),
    );
    nearSeats.push(
      subtract(transform(near, i === 0 ? 0 : 180, [x, 0, 0]), ring(50, v.fixedInner - 0.2, -7, 8)),
    );
    const polarityMark = union(
      box([1.6, 0.45, 0.35], [-0.8, 4.975, v.clampBottom - 3.25]),
      ...(i === 1 ? [box([0.45, 1.6, 0.35], [-0.225, 4.4, v.clampBottom - 3.25])] : []),
    );
    add(
      `Cell ${i + 1} outer insulating seat · PA12 D23 shoulder / D12.7 pilot · D9 contact access · recessed output guard`,
      transform(union(far, polarityMark), i === 0 ? 0 : 180, [x, 0, 0]),
      'PA12',
      '3D PRINT',
      polymer,
      {
        Retention:
          'D12.7 pilot in D13 through-bore; D23 shoulder bears on an unbroken metal ring. One flange permits axial insertion.',
        Electrical:
          'Formed nickel terminal lies in an open slot; exterior pad is backed by 0.8 mm PA12 and recessed 1.2 mm inside its guard.',
      },
    );
    // Near tabs lie in the open insulating bridge channel. Outer tabs pass
    // through their own insulated pilots, with no contact against the metal bore.
    nearTabs.push(
      transform(box([12, 4, 0.2], [-2.5, -2, v.cellTop]), i === 0 ? 0 : 180, [x, 0, 0]),
    );
    const terminal = union(
      box([5, 4, 0.2], [-2.5, -2, v.cellBottom - 0.2]),
      box([0.2, 4, v.cellBottom - v.outputPadZ], [-1.2, -2, v.outputPadZ]),
      box([5.2, 4, 0.2], [-1.6, -2, v.outputPadZ]),
    );
    add(
      `Cell ${i + 1} fixed output · ${i === 0 ? 'MINUS B-' : 'PLUS B+'} · formed nickel t0.2 · exterior pad 5.2x4`,
      transform(terminal, i === 0 ? 0 : 180, [x, 0, 0]),
      'Ni200',
      'FORM / SPOT WELD',
      i === 0 ? 0x58616e : 0xbc574b,
      {
        ElectricalNode: i === 0 ? 'B-' : 'B+',
        Service:
          'Access axially from the outside of the compression disk. Form tabs and solder leads before spot-welding to cells. Lay leads in the open inward-facing guard notch; provide strain relief.',
        LoadPath:
          'Contact tabs do not restrain the cells. The insulating shoulder and continuous metal ring carry axial load.',
      },
    );
  }
  // A supported, insulated series bridge directly against the bulkhead. Its two
  // exposed ends meet only the intended opposite-polarity cell terminals.
  const bridgePath = [
    [-20.2, 0],
    [-20.2, -16],
    [20.2, -16],
    [20.2, 0],
  ];
  const bridge = (width: number, z: number, h: number) =>
    union(
      ...bridgePath.slice(1).map((b, i) => {
        const a = bridgePath[i],
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        return transform(
          box([Math.hypot(dx, dy) + width, width, h], [-width / 2, -width / 2, z]),
          (Math.atan2(dy, dx) * 180) / Math.PI,
          [a[0], a[1], 0],
        );
      }),
    );
  add(
    '2S insulating cradle · PA12 · two D12.7 locating pilots h1.45 · bulkhead-backed shoulders · open B1 channel',
    subtract(
      union(...nearSeats, bridge(5, v.cellTop + 0.2, -v.cellTop - 0.2)),
      bridge(3.4, v.cellTop - 0.05, 0.3),
    ),
    'PA12',
    '3D PRINT',
    polymer,
    {
      Retention:
        'Pilots seat in two D13 x1.5 blind bulkhead counterbores. Shoulder faces contact Z0; 3.5 mm of metal remains toward the gas chamber.',
      Manufacturing:
        'Flat-bottom sockets are a secondary drilling/counterboring operation. No through-cell holes or milled pockets in the pressure web.',
    },
  );
  add(
    '2S midpoint B1 bridge · nickel w3 t0.2 · integral cell tabs · cell 1 positive to cell 2 negative',
    union(bridge(3, v.cellTop, 0.2), ...nearTabs),
    'Ni200',
    'FORM / SPOT WELD',
    0xb99450,
    {
      ElectricalNode: 'B1',
      Service:
        'Accessible series midpoint on the supported bridge at the bulkhead. B- and B+ are the power outputs on the exterior compression-disk face.',
    },
  );
  out.push(...mountedWing(p, v.controllerPlateBottom));
  return out;
}

export const wingMounts = (p: Parameters): [number, number][] =>
  [-1, 1].flatMap((sx) =>
    [-1, 1].map((sy) => [(sy * +p.wingPitchY) / 2, (sx * +p.wingPitchX) / 2] as [number, number]),
  );

/** Shared F405 stack, including isolated mounts and thickness-matched screws. */
export function mountedWing(
  p: Parameters,
  carrierBottom: number,
  carrierThickness = +p.plateThickness,
): Piece[] {
  const out: Piece[] = [];
  const rp = {
    ...releaseDefaults,
    wingBattery: '2x18650',
    wingHolePitchX: p.wingPitchX,
    wingHolePitchY: p.wingPitchY,
  };
  const fcZ = carrierBottom - 4;
  for (const piece of controllerPieces(rp)) {
    if (piece.shape.kind !== 'transform') throw new Error('Expected placed library controller');
    // Retain the library's damper thread placement, but use a cap screw sized
    // for this carrier thickness instead of burying its original flat head.
    const resizeFrameScrew = (s: Shape): Shape => {
      if (s.kind === 'transform' || s.kind === 'rotate')
        return { ...s, child: resizeFrameScrew(s.child) };
      if (s.kind !== 'fastener') throw new Error('Expected library frame fastener');
      return {
        ...s,
        parameters: {
          ...s.parameters,
          length: carrierThickness + 2,
          threadLength: carrierThickness + 2,
          head: 'socket-cap',
          headSize: 3.8,
          headHeight: 2,
          driveWidth: 1.5,
          driveDepth: 1,
        },
      };
    };
    const frame = piece.label.startsWith('WING MINI frame screw');
    const shape = transform(frame ? resizeFrameScrew(piece.shape.child) : piece.shape.child, 90, [
      0,
      0,
      fcZ,
    ]);
    const label = frame
      ? `${piece.label.split(' · ')[0]} · ISO 4762 M2x${carrierThickness + 2} · damper lower end only`
      : piece.label;
    out.push({
      ...piece,
      label,
      group: groups.controller,
      shape,
      material: piece.label.includes('silicone') ? 'silicone' : 'supplier assembly',
      process: 'BUY',
      metadata: {
        ...piece.metadata,
        Library: 'rocket-release / controllerPieces; library stack and damper interfaces retained',
        Fit: 'PCB outlines and hole pitches are library fit references; verify purchased hardware.',
      },
    });
  }
  return out;
}

export function spacers(p: Parameters, carrierTop: number, carrierBottom: number): Piece[] {
  const v = layout(p),
    out: Piece[] = [];
  const add = (
    label: string,
    shape: Shape,
    material = 'Al6061',
    process = 'TURN / DRILL / TAP',
    metadata?: Record<string, string>,
    group: readonly string[] = groups.battery,
  ) =>
    out.push({
      label,
      shape,
      material,
      process,
      color: metal,
      metadata,
      group,
    });
  // The bulkhead-side tier has two female ends, so it leaves with the module.
  // Only the outer tier retains a male end to clamp the intermediate disk.
  const tiers = [
    {
      bottom: carrierTop,
      top: 0,
      maleEnd: null,
    },
    {
      bottom: v.clampTop,
      top: carrierBottom,
      maleEnd: carrierBottom + 8,
    },
  ];
  const hole = blindTapDimensions(4, 8 - v.t);
  const serviceHole = blindTapDimensions(4, electronicsMountPenetration);
  ties.forEach(([x, y], i) => {
    const endScrew = axialScrew(4, 8, v.clampBottom + 8, 0, 0, true);
    tiers.forEach((t, j) => {
      const residualWeb =
        t.top - t.bottom - hole.totalDepth - (j === 0 ? serviceHole.totalDepth : 0);
      if (residualWeb < 2)
        throw new Error('Spacer blind drilling leaves less than 2 mm solid web.');
      const body = bore(4, t.bottom, t.top - t.bottom);
      add(
        `Turned spacer ${i + 1}.${j + 1} · Al6061 D8 L${(t.top - t.bottom).toFixed(2)} · M4x0.7 · ${j === 0 ? 'female / female service column' : 'male / female · relief L1.4'} · blind full depth ${hole.fullDepth.toFixed(2)}`,
        at(
          subtract(
            t.maleEnd === null ? body : union(body, turnedStud(4, 0.7, t.top, t.maleEnd)),
            at(
              blindTap(hole, j === 1 ? (-360 * hole.penetration) / 0.7 : (360 * t.bottom) / 0.7),
              0,
              0,
              t.bottom,
            ),
            ...(j === 0
              ? [rotate(blindTap(serviceHole, (-360 * serviceHole.penetration) / 0.7), 180, 'x')]
              : []),
          ),
          x,
          y,
        ),
        'Al6061',
        'TURN / DRILL / TAP',
        {
          BlindThread: blindTapNote(hole),
          ...(j === 0
            ? {
                BulkheadThread: blindTapNote(serviceHole),
                Service:
                  'Female M4 end faces the bulkhead at Z0. Remove the four gas-side M4x16 screws to lift the columns and electronics off together; do not unscrew the columns.',
              }
            : {
                MaleThread:
                  'M4x0.7: D3.10 relief neck L1.40 at shoulder; tip chamfer 0.35x45 degrees. Finish-die lead must fit within 2P relief; otherwise use a suitable threading tool or revise the part. Blend relief corners and verify root strength.',
              }),
          Engagement:
            j === 0
              ? `Bulkhead screw penetration ${serviceHole.penetration.toFixed(2)} mm; exclude the 0.45 mm mouth chamfer and actual purchased screw tip lead from usable engagement. Verify thread stripping and column strength.`
              : `Receiving tier engagement at most ${(hole.penetration - hole.entryDepth - 0.35).toFixed(2)} mm after mouth and tip chamfers; the plate clearance contains the relief neck.`,
          ResidualWeb: `${residualWeb.toFixed(2)} mm ${j === 0 ? 'between opposed drill tips' : 'to stud shoulder'}, including drill points.`,
        },
      );
    });
    const sealing =
      'D4.5 clearance holes penetrate the pressure web. Seal both head-to-washer and washer-to-web interfaces with a compatible removable gas-rated gasket compound; a flat washer alone is not a seal. Renew and leak-test after service. Do not credit compound as fastener retention.';
    add(
      `BUY module mounting screw ${i + 1} · ISO 4762 M4x16 · A2-70 · hex 3`,
      axialScrew(4, electronicsMount.screwLength, -electronicsMountPenetration, x, y),
      'stainless steel',
      'BUY',
      {
        Service:
          'Access from the exposed parachute/gas face with a straight 3 mm hex key. Support and electrically disconnect the module before removing the four screws; the outer stack stays assembled.',
        Sealing: sealing,
      },
      groups.moduleMount,
    );
    add(
      `BUY module mounting washer ${i + 1} · ISO 7089 M4 · D9/4.3 t0.8 · A2`,
      at(
        ring(
          electronicsMount.washerOuterDiameter / 2,
          electronicsMount.washerInnerDiameter / 2,
          electronicsMount.webThickness,
          electronicsMount.washerThickness,
        ),
        x,
        y,
      ),
      'stainless steel',
      'BUY',
      { Sealing: sealing },
      groups.moduleMount,
    );
    add(
      `BUY end-plate screw ${i + 1} · ISO 4762 M4x8 · A2`,
      at(endScrew, x, y),
      'stainless steel',
      'BUY',
    );
  });
  return out;
}
