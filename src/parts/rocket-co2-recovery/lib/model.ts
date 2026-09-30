import type { Parameters } from '../../../core/types';
import type { Shape } from '../../rocket-release/lib/shapes';
import {
  box,
  cylinder,
  circle,
  plate,
  ring,
  subtract,
  union,
  rotate,
  transform,
} from '../../rocket-release/lib/shapes';
import { screw } from '../../rocket-release/lib/hardware';
import { layout, dispenserMounts, cartridgeRearZ, bodyEye, parachuteExitRadius } from './layout';
import { electronics } from './electronics';
import { electronics4s } from './electronics-4s';
import { finder } from './finder';
import { groups, grouped } from './groups';
import { bodyStructure, bodyJoints, bodyScrewSeat } from './body';
import {
  bulkhead,
  dispenser,
  anchor,
  metal,
  dark,
  polymer,
  at,
  bore,
  tubeFastener,
  tubeSeat,
  radialHole,
  parachuteChamberTube,
} from './mechanical';

export interface Piece {
  group?: readonly string[];
  label: string;
  color: number;
  material: string;
  process: string;
  shape?: Shape;
  library?: {
    kind: 'cartridge' | 'cell' | 'module';
    model: string;
    offset: [number, number, number];
    inverted: boolean;
    azimuth?: number;
  };
  metadata?: Record<string, string>;
}
function sourcePieces(p: Parameters, state: string): Piece[] {
  const v = layout(p),
    out: Piece[] = [];
  const shift = state === 'separated' ? -+p.separation : 0;
  const add = (
    group: readonly string[],
    label: string,
    shape: Shape,
    material = 'Al6061',
    process = 'TURN / DRILL / TAP',
    color = metal,
    moving = true,
    metadata?: Record<string, string>,
  ) =>
    out.push({
      group,
      label,
      shape: at(shape, 0, 0, moving ? shift : 0),
      material,
      process,
      color,
      metadata,
    });
  const cut = (s: Shape) =>
    state === 'cutaway' ? subtract(s, box([55, 110, 1800], [0, -55, -300])) : s;
  add(
    groups.noseStructure,
    `Separating bulkhead · Al6061 · OD90 flange t5 · fixed D86 / O-ring D${(2 * v.releaseSpigot).toFixed(2)} spigots L20 · wall3 · drilled interfaces`,
    cut(bulkhead(p)),
    'Al6061',
    'TURN / DRILL / TAP',
    metal,
    true,
    {
      Manufacturing: `Turn OD90 flange t5, fixed electronics-side D86 x20 spigot and O-ring release-side D${(2 * v.releaseSpigot).toFixed(2)} x20 spigot in one blank. Both skirt walls are 3 mm before fitting. Finish-turn only the fixed seat as needed to fit the measured tube bore; preserve the specified release-side clearance and seal groove. Secondary axial/radial drilling and tapping only; no milled pockets or integral lugs.`,
      Stock:
        'Finished OD90 x45 from D100 x70 Al6061-T6 round stock: 25 mm gross axial reserve for facing, cut-off and workholding combined, not a guaranteed gripping length. Confirm the jaw engagement and two-setup sequence with the machinist. Turn the complete axisymmetric profile before drilling and tapping.',
      Drilling: `Central D25.4; 6x M3x0.5 THROUGH on PCD33 at 30+60n deg; 4x D4.5 THROUGH clearance holes at R34 /45+90n deg for removable-module screws, no M4 tapping. Deburr without enlarging washer seating faces. ${v.fourS ? 'Battery sockets are in the separate foundation, not in this pressure web.' : 'Two D13 flat-bottom locating sockets depth1.5 at X+/-29; 3.5 mm pressure web remains.'} D6.4 through for M6 anchor at Y29; 4x radial M3 at Z-10 /45+90n deg; nylon M2.5x0.45 at Z14.`,
      Sealing:
        'Seal M3 dispenser threads with compatible removable pneumatic thread sealant. The four M4 clearance holes need removable gas-rated gasket compound at both head/washer and washer/web faces. Flat washers and threads alone are not gas seals; renew sealing and leak-test after module removal.',
      Service:
        'Four gas-side ISO 4762 M4x16 screws and ISO 7089 M4 washers release the female-ended electronics columns. Withdraw toward the nose after removing the surrounding electronics tube and disconnecting wiring; internal plates stay assembled. For 2S, support the bulkhead-backed insulating cradle and cells while lifting; their near-end preload is released. The 4S pack retains its independent foundation and clamp.',
    },
  );
  for (const item of grouped(dispenser(p), groups.deployment))
    out.push({ ...item, shape: at(item.shape!, 0, 0, shift) });
  out.push({
    label: 'BUY Leland 82122 / 16 g CO2 · 3/8-24 UNF · D21.844 x88.392 · library exterior',
    color: metal,
    material: 'steel cartridge',
    group: groups.deployment,
    process: 'BUY',
    library: {
      kind: 'cartridge',
      model: 'leland-82122',
      offset: [0, 0, cartridgeRearZ + shift],
      inverted: true,
      azimuth: 315,
    },
  });
  add(
    groups.deployment,
    'Dispenser flange gasket · EPDM D42 /25.4 x0.5 · six D3.4 holes',
    plate(
      circle(21),
      [circle(12.7), ...dispenserMounts.map(([x, y]) => circle(1.7, x, y))],
      5,
      0.5,
    ),
    'EPDM',
    'CUT',
    dark,
  );
  dispenserMounts.forEach(([x, y], i) => {
    const s = screw(3, 8, { head: 'countersunk', headDiameter: 6, headHeight: 1.7 });
    if (s.kind === 'fastener') Object.assign(s.parameters, { driveWidth: 2, driveDepth: 1.2 });
    add(
      groups.deployment,
      `BUY dispenser flange screw ${i + 1} · DIN 7991 M3x8 · A2 · head D6 hex2`,
      at(s, x, y, 2.5),
      'stainless steel',
      'BUY',
      metal,
      true,
      {
        Sealing:
          'Seal the bulkhead through-thread with a compatible removable pneumatic thread sealant; verify assembled chamber leakage.',
      },
    );
  });
  add(
    groups.noseStructure,
    'Parachute-side spigot seal · elastomer compressed envelope · groove width2.6 depth1.4',
    ring(43, v.releaseSpigot - 1.4, 20.8, 2),
    'EPDM',
    'BUY / FIT REFERENCE',
    dark,
  );
  for (const item of grouped(anchor(5.5, 0, false, 29), groups.harness))
    out.push({ ...item, shape: at(item.shape!, 0, 0, shift) });
  for (const item of [
    ...grouped(v.fourS ? electronics4s(p) : electronics(p), groups.battery),
    ...grouped(finder(p), groups.finder),
  ])
    out.push({
      ...item,
      ...(item.shape ? { shape: at(item.shape, 0, 0, shift) } : {}),
      ...(item.library
        ? {
            library: {
              ...item.library,
              offset: [
                item.library.offset[0],
                item.library.offset[1],
                item.library.offset[2] + shift,
              ],
            },
          }
        : {}),
    });
  v.cellPositions.forEach(([x, y], i) =>
    out.push({
      label: `BUY battery ${i + 1} · ${v.cell.name} · ${i % 2 === 0 ? 'positive toward bulkhead' : 'negative toward bulkhead'} · ${v.cellCount}S1P`,
      color: 0x6693a9,
      material: 'Li-ion cell',
      group: groups.battery,
      process: 'BUY',
      library: {
        kind: 'cell',
        model: String(p.cellModel),
        offset: [x, y, (i % 2 === 0 ? v.cellBottom : v.cellTop) + shift],
        inverted: i % 2 === 1,
      },
    }),
  );
  const fixedHoles = [45, 135, 225, 315].map((a) => tubeSeat(a, -10));
  const pinAngles = Array.from({ length: +p.pinCount }, (_, i) => 60 + (360 * i) / +p.pinCount);
  for (const [i, a] of [45, 135, 225, 315].entries())
    add(
      groups.externalScrews,
      `BUY electronics tube screw ${i + 1} · DIN 7991 M3x6 · A2 · head D6 hex2`,
      tubeFastener(a, -10),
      'stainless steel',
      'BUY',
    );
  for (const [i, a] of pinAngles.entries()) {
    if (state !== 'separated')
      add(
        groups.shearScrews,
        `BUY shear screw ${i + 1} · DIN 965 M2.5x8 countersunk 90 deg · PA66 nylon · lot break force must be measured`,
        tubeFastener(a, 14, true),
        'PA66 nylon',
        'BUY',
        0xe7b786,
        false,
        {
          Release:
            'Single-shear connection at tube ID86; the threaded section crosses the shear plane. Nyfast MS-M025-0045-CSKP008 supplier envelope: head D4.7 h1.5, cross drive. Screw break load is not inferred from nominal diameter. Seal the head seat with a compatible removable sealant; no proud washer.',
        },
      );
  }
  for (const item of grouped(bodyStructure(p), groups.bodyStructure))
    out.push({ ...item, shape: item.label.includes('bulkhead') ? cut(item.shape!) : item.shape });
  const hideTubes = ['mechanisms', 'bulkhead', 'printed-parts', 'electronics', 'finder'].includes(
    state,
  );
  if (!hideTubes) {
    add(
      groups.upper,
      'Electronics tube · OD90 ID86 · four metal screws · separate ambient static port',
      cut(
        subtract(
          ring(45, 43, -v.electronicsTubeLength, v.electronicsTubeLength),
          ...fixedHoles,
          ...[90, 270].map((a) => tubeSeat(a, -v.electronicsTubeLength + 5)),
          cylinder(0.75, 8, [39, 0, -v.electronicsTubeLength + 13], 'x'),
        ),
      ),
      'duralumin; alloy / temper unspecified',
      'CUT / DRILL',
      0x628293,
    );
    add(
      groups.lower,
      `Parachute pressure chamber tube · OD90 ID86 · inner exit R${parachuteExitRadius} · nylon shear connection`,
      cut(
        subtract(
          parachuteChamberTube(+p.bayLength),
          ...pinAngles.map((a) => tubeSeat(a, 14, true)),
          ...bodyJoints(p)
            .filter((j) => j.z < v.bodyEnd)
            .map((j) => bodyScrewSeat(j.angle, j.z)),
        ),
      ),
      'duralumin; alloy / temper unspecified',
      'CUT / TURN EXIT RADIUS / DRILL / DEBURR / POLISH',
      0x628293,
      false,
      {
        ParachuteExit: `Continuous internal R${parachuteExitRadius} at the nose-facing mouth (local Z5), tangent to ID86 at Z6 and the end face at D88. OD90 is retained; nominal end land is 1 mm. The parachute exits toward the released nose.`,
        EdgeFinish:
          'Turn the circular internal radius, remove all burrs and polish the complete fabric-contact surface and its transitions. No sharp tool marks or proud edges; verify with the actual fabric and sleeved harness. A straight chamfer is not the specified rounded profile.',
        Fits: 'The rounding occupies only the first 1 mm of the mouth. Nylon shear-hole centres remain 9 mm from the end, and the closed O-ring contact band remains on the full D86 bore.',
      },
    );
  }
  if (!hideTubes) {
    const base = -v.electronicsTubeLength;
    const fairing = union(
      subtract(
        { kind: 'cone', bottom: 0, top: 45, height: 140, z: base - 140 },
        { kind: 'cone', bottom: 0, top: 43, height: 138, z: base - 138 },
      ),
      // Fixed D86 cuff meets the tube bore; join it to the cone with a full shoulder.
      ring(45, v.fixedSpigot - 2, base - 1, 1),
      ring(v.fixedSpigot, v.fixedSpigot - 2, base - 0.05, 10.05),
    );
    add(
      groups.nose,
      'Nose fairing · unfilled dielectric polymer · OD90 L140 · fixed cuff D86 · wall2 · RF window',
      cut(subtract(fairing, ...[90, 270].map((a) => radialHole(a, base + 5, 3)))),
      'unfilled dielectric polymer',
      '3D PRINT',
      0xe0d9cb,
    );
    if (!v.directMotor) {
      add(
        groups.lower,
        'Payload tube · duralumin OD90 ID86 · computers / cameras retained behind pressure bulkhead',
        cut(
          subtract(
            ring(45, 43, v.bodyEnd + 8, v.rearBulkhead! - v.bodyEnd - 8),
            ...bodyJoints(p)
              .filter((j) => j.z > v.bodyEnd)
              .map((j) => bodyScrewSeat(j.angle, j.z)),
          ),
        ),
        'duralumin; alloy / temper unspecified',
        'CUT / DRILL',
        0x628293,
        false,
      );
      add(
        groups.payload,
        'Computer and camera installation space · D54 · equipment and brackets not supplied',
        bore(27, v.bodyEnd + 55, +p.payloadBayLength - 85),
        'reserved installation volume',
        'REFERENCE',
        0x4d6879,
        false,
        {
          Scope:
            'Reserved fit envelope between the four recovery ties. Actual computers, cameras, shock mounts, wiring and thermal design are not specified.',
        },
      );
    } else {
      add(
        groups.motor,
        'Direct motor interface tube · OD90 ID86 · two rows of six M4 fixings · no lower electronics bay',
        cut(
          subtract(
            ring(45, 43, v.bodyEnd + 8, 42),
            ...bodyJoints(p)
              .filter((j) => j.z > v.bodyEnd)
              .map((j) => bodyScrewSeat(j.angle, j.z)),
          ),
        ),
        'duralumin; alloy / temper unspecified',
        'CUT / DRILL',
        0x628293,
        false,
        {
          Interface:
            'The integral L26 aft collar supports this tube. The tube extends to the separate motor datum 50 mm behind the front web face, retaining 28.4 mm beyond the central M8 bolt head. Actual motor and thrust mount are not supplied.',
        },
      );
    }
    add(
      groups.motor,
      'Motor-side interface datum · actual motor and thrust mount not supplied',
      ring(45, 43, v.motorInterfaceZ, 20),
      'interface envelope',
      'REFERENCE',
      0x505a63,
      false,
    );
  }
  for (const [i, a] of [90, 270].entries())
    add(
      groups.externalScrews,
      `BUY fairing retaining screw ${i + 1} · DIN 7991 M3x6 · A2 · head D6 hex2`,
      tubeFastener(a, -v.electronicsTubeLength + 5),
      'stainless steel',
      'BUY',
    );
  if (!['mechanisms', 'bulkhead', 'printed-parts', 'electronics', 'finder'].includes(state)) {
    add(
      groups.canopy,
      'Packed drogue + main · D' +
        p.packDiameter +
        ' x' +
        p.packLength +
        ' · fabric routing envelope only',
      bore(+p.packDiameter / 2, v.packBottom, +p.packLength),
      'fabric',
      'REFERENCE',
      0xc57c4c,
    );
    // Nose branch clears the cartridge; the body branch stows behind the pack.
    // These endpoint references do not model textile deployment dynamics.
    const cord = (a: [number, number, number], b: [number, number, number]): Shape => {
      const d = b.map((n, i) => n - a[i]),
        len = Math.hypot(...d),
        angle = (Math.atan2(d[1], d[0]) * 180) / Math.PI;
      return transform(
        rotate(bore(1.5, 0, len), (Math.acos(d[2] / len) * 180) / Math.PI, 'y'),
        angle,
        a,
      );
    };
    add(
      groups.harness,
      'Nose extraction bridle · sleeved soft eye · routing reference',
      cord([0, 29, 17.5], [0, 29, v.packBottom]),
      'textile',
      'REFERENCE',
      polymer,
    );
    add(
      groups.harness,
      'Body retention bridle · stowed below pack / centre exit after extraction · sleeved textile reference',
      union(
        // A sleeved soft eye wraps the rounded crown, perpendicular to its plane.
        at(
          rotate({ kind: 'torus', radius: 4.8, wireRadius: 1.5, arc: 360 }, 90, 'y'),
          0,
          0,
          v.bodyEnd - bodyEye.height + bodyEye.barDiameter / 2,
        ),
        cord(
          [0, 0, v.bodyEnd - bodyEye.height + bodyEye.barDiameter / 2 - 6],
          [
            0,
            0,
            state === 'separated'
              ? v.packBottom + +p.packLength + shift
              : v.packBottom + +p.packLength + 5,
          ],
        ),
      ),
      'textile',
      'REFERENCE',
      polymer,
      false,
      {
        Routing:
          'Simplified endpoint reference. Separate body and nose harness branches meet at the parachute junction. No line alongside the D80 pack in the 3 mm tube gap. Set actual line lengths and abrasion protection on the packed assembly.',
      },
    );
  }
  if (state === 'bulkhead') return out.filter((x) => x.label.startsWith('Separating bulkhead'));
  if (state === 'printed-parts')
    return out
      .filter((x) => x.process === '3D PRINT')
      .map((x, i) => ({
        ...x,
        shape: at(x.shape!, ((i % 4) - 1.5) * 60, Math.floor(i / 4) * 50, 0),
      }));
  if (state === 'finder')
    return out.filter((x) => /^(Nose finder|BUY finder|ZX908|JHE|PWM Switch)/.test(x.label));
  if (state === 'electronics')
    return out.filter((x) =>
      /^(Battery |Flight-controller |Turned spacer|BUY module mounting|BUY end-plate|BUY controller carrier|Cell |2S |4S |LCH7 |BUY LCH7|BUY B2 |Series bridge|BUY battery|BUY SpeedyBee|BUY WING|WING MINI)/.test(
        x.label,
      ),
    );
  return out;
}

/** One placement for preview and export: nose +Z, parachutes/payload -Z. */
export function pieces(p: Parameters, state: string): Piece[] {
  return sourcePieces(p, state).map((item) => ({
    ...item,
    ...(item.shape ? { shape: rotate(item.shape, 180, 'x') } : {}),
    ...(item.library
      ? {
          library: {
            ...item.library,
            offset: [item.library.offset[0], -item.library.offset[1], -item.library.offset[2]] as [
              number,
              number,
              number,
            ],
            inverted: !item.library.inverted,
            azimuth: -(item.library.azimuth ?? 0),
          },
        }
      : {}),
  }));
}
