import guidePart from '../../linear-guide/part';
import { ballScrewDefaults } from '../../ball-screw/lib/parts/ball-screw-geometry';
import { motorPieces } from '../../machine-drive-motor/lib/model';
import { bearingPieces, socketScrew } from './hardware';
import { box, cylinder, subtract, type Shape, type Vec } from './shapes';
import type { MachinePiece } from './model';

const pose = (child: Shape, translation: Vec, rotation: Vec = [0, 0, 0]): Shape => ({
  kind: 'transform',
  child,
  translation,
  rotation,
});
/** Assembly datums: base top 740, shaft centre 785, rail seat 819, table underside 835. */
export function feedAxis(carriage: number): MachinePiece[] {
  const out: MachinePiece[] = [];
  const add = (label: string, shape: Shape, moving = false, color = 0xa6b0b8, buy = false) =>
    out.push({
      label,
      shape,
      color,
      group: moving ? 'Feed carriage' : 'Shuttle',
      procurement: buy ? 'BUY' : 'MAKE',
    });
  const bolt = (
    label: string,
    at: Vec,
    d: number,
    length: number,
    moving = false,
    rotation: Vec = [0, 0, 0],
  ) => {
    const item = socketScrew(label, [0, 0, 0], 'z', d, length);
    add(label, pose(item.shape, at, rotation), moving, item.color, true);
  };
  const baseHoles: Shape[] = [];
  for (const x of [-500, -180])
    for (const y of [-150, 150]) {
      baseHoles.push(cylinder(4.25, 14, [x, y, 727]));
      add(
        `Welded infeed mounting pad ${x} ${y}`,
        subtract(box([35, 36, 10], [x - 17.5, y - 18, 740]), cylinder(4, 12, [x, y, 739])),
      );
      bolt(`Feed base M8 underside fixing ${x} ${y}`, [x, y, 728], 8, 20, false, [180, 0, 0]);
    }
  const rail = {
    ...guidePart.defaults,
    ...guidePart.presets.find((v) => v.id === 'mgn15c')!.parameters,
    length: 400,
    endOffset: 15,
  };
  const tableHoles: Shape[] = [];
  for (const y of [-195, 195]) {
    const bearerHoles: Shape[] = [];
    for (let x = -520; x <= -160; x += 40) {
      bearerHoles.push(cylinder(1.5, 13, [x, y, 807]));
      bolt(`MGN15 rail M3x16 ${x} ${y}`, [x, y, 824.5], 3, 16);
    }
    for (const x of [-530, -350, -140]) {
      baseHoles.push(cylinder(3.25, 14, [x, y, 727]));
      bearerHoles.push(cylinder(3, 20, [x, y, 739]));
      bolt(`Rail bearer M6 underside ${x} ${y}`, [x, y, 728], 6, 30, false, [180, 0, 0]);
    }
    add(
      `Machined rail bearer ${y}`,
      subtract(box([430, 40, 79], [-550, y - 20, 740]), ...bearerHoles),
      false,
      0x536675,
    );
    add(
      `MGN15 feed rail ${y}`,
      pose({ kind: 'library-guide', parameters: rail, state: 'rail' }, [-335, y, 819]),
      false,
      0xa6b0b8,
      true,
    );
    for (const dx of [-25, 25]) {
      add(
        `MGN15C recirculating carriage ${y} ${dx}`,
        pose(
          {
            kind: 'library-guide',
            parameters: { ...rail, position: 50 + ((carriage + dx + 335) * 100) / (400 - 42.1) },
            state: 'carriage',
          },
          [-335, y, 819],
        ),
        true,
        0xa6b0b8,
        true,
      );
      for (const hx of [-10, 10])
        for (const hy of [-12.5, 12.5]) {
          const at: Vec = [carriage + dx + hx, y + hy, 847];
          tableHoles.push(
            cylinder(1.7, 14, [at[0], at[1], 834]),
            cylinder(2.6, 3.1, [at[0], at[1], 844]),
          );
          bolt(`Carriage M3x12 ${y} ${dx} ${hx} ${hy}`, [at[0], at[1], 844], 3, 12, true);
        }
    }
  }
  const screw = {
    ...ballScrewDefaults,
    length: 425,
    driveJournalLength: 19,
    fixedJournalLength: 28,
    supportJournalLength: 24,
  };
  add(
    'SFU1605 library shaft · ground D12/D10 journals',
    pose(
      {
        kind: 'library-ball-screw',
        parameters: { ...screw, rotation: (((carriage + 357.5) / 5) * 360) % 360 },
        state: 'screw',
      },
      [-357.5, 0, 785],
      [0, 90, 0],
    ),
    false,
    0xa6b0b8,
    true,
  );
  add(
    'SFU1605 library flanged ball nut · six mounting holes',
    pose(
      { kind: 'library-ball-screw', parameters: screw, state: 'nut' },
      [carriage, 0, 785],
      [0, 90, 0],
    ),
    true,
    0xa6b0b8,
    true,
  );
  // The flanged nut is inserted axially into the bored saddle before fastening it to the table.
  const saddleHoles: Shape[] = [cylinder(15.8, 42, [carriage - 16, 0, 785], 'x')];
  for (const degrees of [45, 90, 135, 225, 270, 315]) {
    const a = (degrees * Math.PI) / 180,
      y = 19 * Math.sin(a),
      z = 785 - 19 * Math.cos(a);
    saddleHoles.push(cylinder(2.5, 17, [carriage - 16, y, z], 'x'));
    bolt(`SFU flange M5x25 ${degrees}`, [carriage - 25, y, z], 5, 25, true, [0, -90, 0]);
  }
  for (const x of [carriage - 7, carriage + 17])
    for (const y of [-23, 23]) {
      saddleHoles.push(cylinder(3, 22, [x, y, 815]));
      tableHoles.push(cylinder(3.25, 14, [x, y, 834]), cylinder(5, 6.1, [x, y, 841]));
      bolt(`Nut saddle M6x25 ${x} ${y}`, [x, y, 841], 6, 25, true);
    }
  add(
    'Bored SFU nut saddle',
    subtract(box([40, 60, 74], [carriage - 15, -30, 761]), ...saddleHoles),
    true,
  );
  add(
    'Feed bridge plate below rollers',
    subtract(box([85, 510, 12], [carriage - 42.5, -220, 835]), ...tableHoles),
    true,
  );
  for (const fixed of [true, false]) {
    const x = fixed ? -541 : -165,
      width = fixed ? 18 : 12,
      bore = fixed ? 12 : 10,
      od = fixed ? 28 : 26;
    const holes: Shape[] = [
      ...(fixed ? [cylinder(9.05, 3, [x + 16, 0, 785], 'x')] : []),
      cylinder(bore / 2 + 0.2, width + 2, [x - 1, 0, 785], 'x'),
      cylinder(od / 2 + 0.05, fixed ? 16 : 10, [x, 0, 785], 'x'),
    ];
    for (const y of [-25, 25]) {
      holes.push(
        cylinder(3.25, 67, [x + width / 2, y, 739]),
        cylinder(5, 11, [x + width / 2, y, 795]),
      );
      baseHoles.push(cylinder(3, 14, [x + width / 2, y, 727]));
      bolt(`${fixed ? 'Fixed' : 'Floating'} support M6x65 ${y}`, [x + width / 2, y, 795], 6, 65);
    }
    add(
      `${fixed ? 'Fixed duplex' : 'Floating'} bearing pedestal`,
      subtract(box([width, 70, 65], [x, -35, 740]), ...holes),
    );
    for (const bx of fixed ? [x, x + 8] : [x + 1])
      for (const item of bearingPieces(
        `${fixed ? '7001 paired' : '6000 floating'} bearing ${bx}`,
        [bx, 0, 785],
        'x',
        bore,
        od,
        8,
      ))
        add(item.label, item.shape, false, item.color, true);
    const capHoles = [cylinder(bore / 2 + 0.2, 4, [x - 3, 0, 785], 'x')];
    for (const y of [-18, 18])
      for (const z of [769, 801]) {
        capHoles.push(cylinder(1.6, 4, [x - 3, y, z], 'x'));
        // This bore is also added to the pedestal, making the cover removable.
        const pedestal = out.find(
          (v) => v.label === `${fixed ? 'Fixed duplex' : 'Floating'} bearing pedestal`,
        )!;
        pedestal.shape = subtract(pedestal.shape, cylinder(1.5, 10, [x - 1, y, z], 'x'));
        bolt(`Bearing end-cover M3 ${x} ${y} ${z}`, [x - 2, y, z], 3, 10, false, [0, -90, 0]);
      }
    add(`Bearing retaining cover ${x}`, subtract(box([2, 50, 40], [x - 2, -25, 765]), ...capHoles));
  }
  add(
    'Fixed bearing shaft spacer',
    subtract(cylinder(9, 2, [-525, 0, 785], 'x'), cylinder(6.05, 4, [-526, 0, 785], 'x')),
    false,
    0xa6b0b8,
    true,
  );
  add(
    'Fixed bearing M12 locknut and washer',
    subtract(
      cylinder(10, 8, [-551, 0, 785], 'x'),
      cylinder(6.05, 10, [-552, 0, 785], 'x', { pitch: 1, internal: true }),
    ),
    false,
    0x303c46,
    true,
  );
  for (const item of motorPieces({ model: '23hs30-2804-me1k' }))
    add(
      `Feed NEMA23 / ${item.label}`,
      pose(item.shape, [-592, 0, 785], [0, 90, 0]),
      false,
      item.color,
      true,
    );
  add(
    'Feed flexible coupling D32 · 6.35 / 10 bores',
    subtract(
      cylinder(16, 29, [-581, 0, 785], 'x'),
      cylinder(3.225, 11.5, [-582, 0, 785], 'x'),
      cylinder(5.05, 21.5, [-570.5, 0, 785], 'x'),
    ),
    false,
    0x303c46,
    true,
  );
  const coupling = out.find((v) => v.label.startsWith('Feed flexible coupling'))!;
  coupling.shape = subtract(
    coupling.shape,
    box([8, 0.8, 18], [-581, -0.4, 785]),
    box([8, 0.8, 18], [-560, -0.4, 785]),
    box([0.6, 28, 34], [-571, -16, 768]),
    box([0.6, 28, 34], [-566, -12, 768]),
  );
  for (const x of [-577, -556]) {
    coupling.shape = subtract(
      coupling.shape,
      cylinder(1.6, 22, [x, -11, 795], 'y'),
      cylinder(2.5, 8, [x, 10, 795], 'y'),
    );
    const item = socketScrew(`Feed coupling clamp M3x20 ${x}`, [x, 10, 795], 'y', 3, 20);
    add(item.label, item.shape, false, item.color, true);
  }
  const motorHoles = [cylinder(19.15, 10, [-593, 0, 785], 'x')];
  for (const y of [-23.57, 23.57])
    for (const z of [-23.57, 23.57]) {
      motorHoles.push(cylinder(2.75, 10, [-593, y, 785 + z], 'x'));
      bolt(`Feed motor M5x15 ${y} ${z}`, [-584, y, 785 + z], 5, 15, false, [0, 90, 0]);
    }
  // Welded upright and foot; fasteners remain accessible from the top.
  add('Feed motor bracket upright', subtract(box([8, 100, 80], [-592, -50, 752]), ...motorHoles));
  const footHoles: Shape[] = [];
  for (const y of [-38, 38]) {
    footHoles.push(cylinder(3.25, 14, [-606, y, 739]));
    baseHoles.push(cylinder(3, 14, [-606, y, 727]));
    bolt(`Motor foot M6x22 ${y}`, [-606, y, 752], 6, 22);
  }
  add('Feed motor bracket foot', subtract(box([31, 100, 12], [-615, -50, 740]), ...footHoles));
  add(
    'Removable feed axis base plate',
    subtract(box([495, 510, 12], [-615, -220, 728]), ...baseHoles),
    false,
    0x536675,
  );
  return out;
}
