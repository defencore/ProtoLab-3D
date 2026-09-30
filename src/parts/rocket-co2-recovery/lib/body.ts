import type { Parameters } from '../../../core/types';
import type { Piece } from './model';
import { groups } from './groups';
import { layout, polar, bodyEye, bodyEyePenetration } from './layout';
import { at, bore, hex, metal, dark, thread, radialHole, axialScrew } from './mechanical';
import { matingHole } from '../../rocket-release/lib/hardware';
import { screw } from '../../rocket-release/lib/hardware';
import {
  circle,
  plate,
  ring,
  rotate,
  transform,
  union,
  subtract,
  type Shape,
} from '../../rocket-release/lib/shapes';

// Local coordinates use the bulkhead datum. The public assembly turns nose-up.
export function bodyJoints(p: Parameters) {
  const v = layout(p);
  // Stagger compact rows by 30 degrees: retain two rows without crowding holes
  // axially in the shorter skirts. End rows stay 8 mm from the tube/skirt edges.
  const rows = v.directMotor
    ? [
        { z: v.bodyEnd - 18, start: 0 },
        { z: v.bodyEnd - 8, start: 30 },
        { z: v.bodyEnd + 16, start: 30 },
        { z: v.bodyEnd + 26, start: 0 },
      ]
    : [v.bodyEnd - 22, v.bodyEnd - 8, v.rearBulkhead! - 22, v.rearBulkhead! - 8].map((z) => ({
        z,
        start: 30,
      }));
  return rows.flatMap(({ z, start }) =>
    Array.from({ length: 6 }, (_, i) => ({ z, angle: start + i * 60 })),
  );
}
export function bodyScrewSeat(angle: number, z: number): Shape {
  // Extend the cutter past the curved OD instead of ending on a tangent face.
  // This preserves all six seats in OpenCASCADE's successive boolean cuts.
  return transform(
    rotate(
      union(bore(2.2, 0, 9), {
        kind: 'cone',
        bottom: 2.1,
        top: 4.7,
        height: 2.6,
        z: 5.7,
      }),
      90,
      'y',
    ),
    angle,
    [...polar(37, angle), z],
  );
}
export function bodyStructure(p: Parameters): Piece[] {
  const v = layout(p),
    out: Piece[] = [];
  const ties = [45, 135, 225, 315].map((a) => polar(v.bodyTieRadius, a));
  const add = (
    label: string,
    shape: Shape,
    material = 'Al6061',
    process = 'TURN / DRILL',
    color = metal,
    metadata?: Record<string, string>,
    group: readonly string[] = groups.bodyStructure,
  ) => out.push({ label, shape, material, process, color, metadata, group });
  const holes = ties.map(([x, y]) => circle(3.3, x, y));
  const anchorHoles = [circle(4.25)];
  for (const [i, z] of (v.directMotor ? [v.bodyEnd] : [v.bodyEnd, v.rearBulkhead!]).entries()) {
    const cutouts = [
      ...ties.map(([x, y]) => bore(3.3, z - 1, 10, x, y)),
      ...(i === 0 ? [bore(4.25, z - 1, 10)] : []),
      ...bodyJoints(p)
        .filter((j) => (j.z < z && j.z > z - v.bodySkirtLength) || (v.directMotor && j.z > z))
        .flatMap((j) => [radialHole(j.angle, j.z, 4), bodyScrewSeat(j.angle, j.z)]),
    ];
    add(
      `${i === 0 ? 'Recovery load bulkhead' : 'Rear payload load bulkhead'} · Al6061 OD90 web8 · front skirt D86 L${v.bodySkirtLength} wall${v.bodySkirtWall}${v.directMotor ? ' / aft motor collar D86 L26 wall5 · total L60' : ''} · four D6.6 fixing holes PCD${v.bodyTieRadius * 2}${i === 0 ? ' · central D8.5 anchor clearance' : ''}`,
      subtract(
        union(
          bore(45, z, 8),
          ring(v.fixedSpigot, v.bodySkirtInner, z - v.bodySkirtLength, v.bodySkirtLength),
          ...(v.directMotor
            ? [ring(v.fixedSpigot, v.bodySkirtInner, z + 8, v.bodySkirtLength)]
            : []),
        ),
        ...cutouts,
      ),
      'Al6061',
      'TURN / DRILL / TAP',
      metal,
      {
        LoadPath: v.directMotor
          ? 'Machined L60 double-sided bulkhead with two L26 wall5 skirts and an 8 mm web. Four M6 backing-plate bolts on PCD62; two rows of six M4 radial screws per skirt, staggered 30 degrees with 8 mm nominal edge distance. Load passes to the body and motor-bay tube. Thicker skirts do not qualify the thinner tube wall: web bending, fastener shear, bearing, tube tear-out and off-axis loads still require verification.'
          : 'Machined web and skirt, four through-ties and two rows of six radial M4 fasteners. Local web bending, tube bearing/tear-out and alloy strength remain unqualified.',
        Manufacturing: `Axisymmetric turned blank with straight accessible bores; all non-axisymmetric features are secondary drilled, countersunk or tapped holes. No milling required. Fixed tube seats are nominal D86: finish-turn to the measured tube bore as needed. The modeled ${v.bodySkirtWall} mm skirt wall is before final fitting.`,
        ...(v.directMotor
          ? {
              Stock:
                'Finished OD90 x60 from D100 x80 round stock: 20 mm gross axial reserve for facing, cut-off and workholding combined. This is not a guaranteed 20 mm gripping length. The machinist must specify jaws, clamping force and the two-setup sequence before cutting; avoid distorting finished thin skirts.',
              Drilling:
                'Central D8.5 through-hole for the M8 eye bolt; D12 x0.5 seal recess on the parachute face. Four D6.6 axial holes on PCD62 at 45+90n degrees. Front M4 rows 8 and 18 mm from the web face; rear rows 8 and 18 mm from the rear web face. Six holes per row; alternate rows start at 0 and 30 degrees. Tube drilling follows the same pattern.',
            }
          : {}),
      },
    );
  }
  add(
    `Harness load-spreading plate · steel D${v.bodyBackingRadius * 2} t4 · central D8.5 anchor hole / four D6.6 fixing holes PCD${v.bodyTieRadius * 2}`,
    plate(circle(v.bodyBackingRadius), [...holes, ...anchorHoles], v.bodyEnd + 8, 4),
    'steel',
    'LASER CUT / DEBURR',
  );
  // Purchased eye: circular ring and tapered foot, with a nominal metal thread.
  // The foot blend is an envelope; preserve the catalogue's full D20 aperture.
  const z = v.bodyEnd;
  const eye = subtract(
    union(
      at(
        rotate(
          {
            kind: 'torus',
            radius: (bodyEye.outerDiameter + bodyEye.innerDiameter) / 4,
            wireRadius: bodyEye.barDiameter / 2,
            arc: 360,
          },
          90,
          'x',
        ),
        0,
        0,
        bodyEye.centreHeight,
      ),
      {
        kind: 'cone',
        bottom: bodyEye.baseDiameter / 2,
        top: bodyEye.barDiameter / 2,
        height: 11,
        z: 0,
      },
    ),
    at(rotate(bore(bodyEye.innerDiameter / 2, -10, 20), 90, 'x'), 0, 0, bodyEye.centreHeight),
    thread(8, 1.25, 17.2, -0.1, true, 0.04),
  );
  add(
    'BUY compact eye nut · Osculati 39.306.08 · AISI316 M8x1.25 · eye D32.6 /20 bar6.3 · H33.3 base D16',
    at(rotate(eye, 180, 'x'), 0, 0, z),
    'AISI316 stainless steel',
    'BUY',
    metal,
    {
      Source: bodyEye.source,
      Assembly: `ISO 4762 M8x20 through the 8 mm web, 4 mm steel backing plate and ISO 7089 M8 washer t1.6. Nominal insertion ${bodyEyePenetration.toFixed(1)} mm; 5.78 mm excluding the screw tip chamfer, before the eye entry chamfer. Verify actual supplied thread depth and engagement; no bolt end projects into the D20 rope aperture.`,
      Retention:
        'Seat the eye base directly on the metal bearing land. Orient the eye before tightening the bolt from behind; use medium-strength anaerobic threadlocker suitable for stainless steel, following its surface preparation and cure instructions. Do not back off the eye to orient it. Add an inspection witness mark.',
      Qualification:
        'Catalogue external dimensions; base blend and internal thread are simplified. Catalogue mass is not a load rating. Supplier thread engagement and assembly shock capacity remain to be verified.',
    },
  );
  add(
    'BUY body eye bolt · ISO 4762 M8x20 A4-80 · hex6 · threadlocker',
    axialScrew(8, bodyEye.boltLength, z - bodyEyePenetration, 0, 0),
    'stainless steel A4-80',
    'BUY',
  );
  add(
    'BUY body eye washer · ISO 7089 M8 D16 /8.4 t1.6',
    ring(8, 4.2, z + 12, bodyEye.washerThickness),
    'stainless steel',
    'BUY',
  );
  add(
    'Body eye seal · EPDM D12 /8.2 t0.6 · installed t0.5',
    ring(6, 4.1, z, 0.5),
    'EPDM',
    'CUT',
    dark,
    {
      Sealing:
        'Install a 0.6 mm gasket in the D12 x0.5 recess; compress to the modeled 0.5 mm thickness. The D16 eye foot bears on the surrounding metal land. Leak-test the assembled chamber.',
    },
  );
  // Remove only the seal recess from the pressure web; the rest of the seat is metal.
  out[0].shape = subtract(out[0].shape!, bore(6, z - 0.05, 0.55));
  if (v.directMotor) {
    out[0].shape = subtract(out[0].shape!, ...ties.map(([x, y]) => bore(5, z - 0.05, 0.6, x, y)));
    ties.forEach(([x, y], i) => {
      const bolt = axialScrew(6, 25, z + 23.4, x, y, true);
      add(
        `BUY compact backing bolt ${i + 1} · ISO 4762 M6x25`,
        bolt,
        'steel; strength grade to specify',
        'BUY',
      );
      add(
        `Compact backing bolt seal ${i + 1} · EPDM D10 /6.2 t0.5`,
        ring(5, 3.1, z, 0.5, x, y),
        'EPDM',
        'CUT',
        dark,
      );
      for (const [j, wz] of [z - 1.6, z + 12].entries())
        add(
          `BUY compact backing washer ${i + 1}.${j + 1} · ISO 7089 M6 D12 /6.4 t1.6`,
          ring(6, 3.2, wz, 1.6, x, y),
          'stainless steel',
          'BUY',
        );
      add(
        `BUY compact backing nut ${i + 1} · ISO 4032 M6x1 AF10 h5`,
        subtract(at(hex(10, z + 13.6, 5), x, y), matingHole(bolt)),
        'steel; strength grade to specify',
        'BUY',
      );
    });
  }
  if (!v.directMotor) {
    const rear = v.rearBulkhead!;
    ties.forEach(([x, y], i) => {
      const start = z - 14,
        end = rear + 20;
      add(
        `Recovery tie rod ${i + 1} · steel D6 L${(end - start).toFixed(0)} · M6x1 ends 36/30 · four-rod load path`,
        at(
          union(
            thread(6, 1, 36, start),
            bore(3, z + 21.9, rear - 9.9 - (z + 21.9)),
            thread(6, 1, 30, rear - 10),
          ),
          x,
          y,
        ),
        'steel; strength grade to specify',
        'TURN / THREAD',
        metal,
        {
          LoadPath:
            'Tension bypasses computers, cameras, circuit boards and battery fixtures. Axial stress screening assumes equal sharing among four rods.',
        },
      );
      const seats = [
        { washer: z - 2.6, nut: z - 7.6 },
        { washer: z + 12, nut: z + 13.6 },
        { washer: rear - 1.6, nut: rear - 6.6 },
        { washer: rear + 8, nut: rear + 9.6 },
      ];
      add(
        `Recovery tie pressure seal ${i + 1} · EPDM D12 /6.2 t1`,
        ring(6, 3.1, z - 1, 1, x, y),
        'EPDM',
        'CUT',
        dark,
      );
      seats.forEach((s, j) => {
        add(
          `BUY recovery tie washer ${i + 1}.${j + 1} · ISO 7089 M6 D12 /6.4 t1.6`,
          ring(6, 3.2, s.washer, 1.6, x, y),
          'stainless steel',
          'BUY',
        );
        add(
          `BUY recovery tie nut ${i + 1}.${j + 1} · ISO 4032 M6x1 AF10 h5`,
          at(subtract(hex(10, s.nut, 5), thread(6, 1, 5.2, s.nut - 0.1, true, 0.05)), x, y),
          'stainless steel',
          'BUY',
        );
      });
    });
  }
  bodyJoints(p).forEach(({ angle, z }, i) => {
    const s = screw(4, 8, { head: 'countersunk', headDiameter: 8, headHeight: 2.3 });
    if (s.kind === 'fastener') Object.assign(s.parameters, { driveWidth: 2.5, driveDepth: 1.8 });
    add(
      `BUY body structural screw ${i + 1} · DIN 7991 M4x8 · head D8 hex2.5 · property class to specify`,
      transform(rotate(s, 90, 'y'), angle, [...polar(37, angle), z]),
      'steel',
      'BUY',
      metal,
      undefined,
      groups.externalScrews,
    );
  });
  return out;
}
