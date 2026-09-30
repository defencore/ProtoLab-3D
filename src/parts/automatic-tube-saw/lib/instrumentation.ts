import type { Parameters } from '../../../core/types';
import { box, cylinder, subtract } from './shapes';
import { measurementPieces } from '../../machine-measurement/lib/model';
import { collection, pose, around, trayLink, profile, paint, metal, dark } from './layout';
import { engineering, DESIGN } from './engineering';
export function instrumentationPieces(p: Parameters, state: string, movingX: number) {
  const sawShape = (shape: ReturnType<typeof box>) =>
    pose(shape, [0, 0, 0], [0, 0, Number(p.angle)]);
  const c = collection('Measurement and process sensors'),
    s = profile(p),
    e = engineering(p),
    wheelZ = s.top + 200 / (2 * Math.PI);
  for (const q of measurementPieces({ model: 'mwe21' }))
    c.add(
      q.label,
      pose(q.shape, [-350, 0, wheelZ]),
      q.color,
      'BUY',
      'Material-contact encoder; calibrate effective circumference and validate wheel contact',
    );
  c.add('Measuring-wheel adjustable bridge', box([50, 190, 10], [-305, -203, wheelZ - 21]), paint);
  c.add(
    'Measuring bridge rear mounting column',
    box([40, 30, wheelZ - 921], [-300, -203, 900]),
    paint,
  );
  c.add(
    'Encoder mounting foot with two M6 through holes',
    subtract(
      box([70, 70, 8], [-315, -223, 900]),
      ...[-22, 22].map((dx) => cylinder(3.3, 10, [-280 + dx, -195, 899])),
    ),
    metal,
  );
  for (const dx of [-22, 22]) c.screw(-280 + dx, -195, 908, 6, 25);
  if (p.feedMode === 'manual') c.pieces.length = 0;
  const beam = (x: number, z: number, y: number, label: string) => {
    const firstPiece = c.pieces.length;
    const onReceiver = [700, 945, 2365].includes(x);
    for (const sign of [-1, 1]) {
      for (const q of measurementPieces({ model: 'e3z-t81' }))
        c.add(
          `${label} · ${sign < 0 ? 'emitter' : 'receiver'} · ${q.label}`,
          pose(q.shape, [x, sign * y, z - 15.5], [0, 0, sign < 0 ? 0 : 180]),
          q.color,
          'BUY',
        );
      c.add(
        `${label} adjustable bracket`,
        subtract(
          box([3, 30, 45], [x + 6, sign * y - 15, z - 22]),
          ...[2.8, 28.2].map((v) => cylinder(1.6, 5, [x + 5, sign * y - 11, z - 15.5 + v], 'x')),
        ),
        metal,
      );
      c.add(
        `${label} bracket post`,
        box([15, 15, Math.max(10, z - 915)], [x + 6, sign * y - 7.5, 900]),
        paint,
      );
      if (onReceiver)
        c.add(
          'Receiver optical post foot to side frame',
          box([35, 65, 6], [x - 4, sign < 0 ? -202 : 142, 890]),
          paint,
        );
      c.add(
        `${label} bolted mounting foot`,
        box([35, 45, 6], [x - 4, sign * y - 22.5, 894]),
        paint,
      );
    }
    if (onReceiver)
      for (const q of c.pieces.slice(firstPiece)) {
        q.shape = around(q.shape, trayLink(0).pivot, [
          (state === 'sorting' && e.shortPart) || state === 'rejecting' ? 60 : 0,
          0,
          0,
        ]);
        q.group = 'Tilting receiver';
      }
  };
  beam(-310, 900 + Math.max(20, s.height / 2), s.width / 2 + 35, 'Leading-edge datum beam');
  beam(-390, 900 + Math.max(20, s.height / 2), s.width / 2 + 35, 'Infeed material present');
  beam(700, 900 + Math.max(20, s.height / 2), 180, 'Receiver entry trailing-edge beam');
  beam(945, 900 + Math.max(20, s.height / 2), 180, 'Receiver park beam');
  beam(2365, 900 + Math.max(20, s.height / 2), 180, 'Receiver remnant park beam');
  beam(610, 900 + Math.max(20, s.height / 2), 180, 'Cut exit tail-clear beam');
  beam(2470, 900 + Math.max(20, s.height / 2), 180, 'Roller outlet clear beam');
  for (const x of [650, 2440]) {
    for (const q of measurementPieces({ model: 'e3z-t81' }))
      c.add(
        'Chute passage beam · ' + q.label,
        pose(q.shape, [x, -350, 450], [0, 0, x < 800 ? -90 : 90]),
        q.color,
        'BUY',
      );
    c.add(
      'Chute beam sidewall bracket',
      box([20, 45, 50], [x < 800 ? 650 : 2427, -373, 425]),
      metal,
    );
  }
  for (const x of [610, 2470])
    for (const sign of [-1, 1]) {
      c.add(
        'Optical bridge outer support post',
        box([25, 25, 109], [x - 4, sign * 180 - 12.5, 785]),
        paint,
      );
      c.add(
        'Optical bridge foot to conveyor frame',
        box([35, 170, 10], [x - 4, sign < 0 ? -300 : 130, 785]),
        paint,
      );
    }
  for (const x of [650, 2440]) {
    for (const q of measurementPieces({ model: 'e3z-t81' }))
      c.add(
        'Scrap passage beam - ' + q.label,
        pose(q.shape, [x, -860, 280], [0, 0, x < 800 ? -90 : 90]),
        q.color,
        'BUY',
      );
    c.add('Scrap beam bracket', box([20, 35, 55], [x - 10, -877, 250]), metal);
  }
  for (const [label, y] of [
    ['Scrap bin presence', -1030],
    ['Chute good bin presence', -660],
  ] as const) {
    for (const q of measurementPieces({ model: 'e2b-m12' }))
      c.add(label + ' - ' + q.label, pose(q.shape, [590, y, 100], [0, 90, 0]), q.color, 'BUY');
    c.add(label + ' support', box([20, 40, 100], [555, y - 20, 40]), paint);
  }
  // Inductive sensors are used only for machine targets; the wheel measures tube length.
  if (p.feedMode !== 'manual') {
    for (const x of [-1100, -500]) {
      for (const q of measurementPieces({ model: 'e2b-m12' }))
        c.add(
          `${x === -1100 ? 'Feed home' : 'Feed overtravel'} · ${q.label}`,
          pose(q.shape, [x, 293, 850], [90, 0, 0]),
          q.color,
          'BUY',
        );
      c.add(
        'Feed sensor angle bracket · D12.2 bore',
        subtract(box([35, 6, 50], [x - 17.5, 269, 820]), cylinder(6.1, 8, [x, 268, 850], 'y')),
        metal,
      );
      c.add('Feed sensor support foot', box([35, 100, 6], [x - 17.5, 265, 814]), paint);
    }
    c.add('Feed carriage steel sensor target', box([30, 4, 20], [movingX - 15, 240, 840]), metal);
  }
  for (const z of [DESIGN.bladeHome - 150, 630]) {
    for (const q of measurementPieces({ model: 'e2b-m12' }))
      c.add(
        `Saw ${z === DESIGN.bladeHome - 150 ? 'down' : 'up'} target sensor · ${q.label}`,
        sawShape(pose(q.shape, [175, 200, z], [90, 0, 0])),
        q.color,
        'BUY',
      );
    c.add(
      'Saw endpoint sensor bracket',
      sawShape(
        subtract(box([35, 32, 40], [157.5, 178, z - 20]), cylinder(6.1, 34, [175, 177, z], 'y')),
      ),
      metal,
    );
  }
  c.add('Saw endpoint sensor support column', sawShape(box([30, 20, 360], [160, 210, 315])), paint);
  c.add('Regulator panel support rail', box([350, 270, 9], [-325, -640, 770]), paint);
  // Three regulator positions make independent pressure settings visible. Their outlines are installation envelopes.
  for (const [i, name] of ['Top clamps', 'Side clamps', 'Transfer roller'].entries()) {
    const x = -300 + i * 90;
    c.add(
      `${name} regulator · bracket-mounted commercial G1/4 envelope`,
      box([50, 45, 55], [x, -410, 785]),
      0x364a59,
      'REFERENCE',
      'Select regulator flow, relieving behavior and port standard; envelope is not an orderable SKU',
    );
    c.add(`${name} regulator knob`, cylinder(18, 30, [x + 25, -387.5, 840]), dark, 'REFERENCE');
    c.add(
      `${name} pressure gauge`,
      cylinder(22, 15, [x + 25, -425, 810], 'y'),
      0xe0e7e8,
      'REFERENCE',
    );
    c.add('Regulator mounting shelf', box([70, 70, 6], [x - 10, -415, 779]), paint);
  }
  for (const q of c.pieces) {
    const output =
      q.group === 'Tilting receiver' ||
      /^(Receiver|Cut exit|Roller outlet|Chute|Scrap|Optical bridge)/.test(q.label);
    if (output) q.shape = pose(q.shape, [e.outfeedOffset, 0, 0]);
  }
  return p.feedMode === 'manual'
    ? c.pieces.filter(
        (q) =>
          !(
            /^(Receiver|Cut exit|Roller outlet|Chute|Scrap|Optical bridge|Infeed material|Leading-edge|BUY Kuebler|Measuring|Encoder mounting|Feed )/.test(
              q.label,
            ) || q.group === 'Tilting receiver'
          ),
      )
    : c.pieces;
}
