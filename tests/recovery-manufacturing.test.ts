import { test } from 'node:test';
import assert from 'node:assert/strict';
import part from '../src/parts/rocket-release/part';
import { pieces } from '../src/parts/rocket-release/lib/model';
import { fastener, fastenerCatalog } from '../src/parts/rocket-release/lib/fastener-catalog';
import {
  manufacturingMetadata,
  threadFeatures,
} from '../src/parts/rocket-release/lib/manufacturing';
import { transform, rotate } from '../src/parts/rocket-release/lib/shapes';
import { screw, matingHole } from '../src/parts/rocket-release/lib/hardware';

const p = part.presets.find((x) => x.id === 'nose-90-86-mg996r-18650-2s-wing-mini')!.parameters;

test('2S nose uses catalog screws, identifies OEM hardware and never disguises custom studs as stock', () => {
  const model = pieces(p, 'assembled');
  const screws = model.filter((x) => fastener(x.shape));
  const tally: Record<string, number> = {};
  for (const piece of screws) {
    const spec = fastenerCatalog(piece.shape, piece.label)!;
    tally[spec.procurement] = (tally[spec.procurement] ?? 0) + 1;
    if (spec.procurement === 'MAKE_CUSTOM_FASTENER')
      assert.match(piece.label, /^Retaining shoulder stud/);
    if (spec.procurement.startsWith('BUY_')) {
      assert.ok([4, 5, 6, 8, 12].includes(+fastener(piece.shape)!.parameters.length));
      assert.match(spec.source, /^https:\/\/www.accu.co.uk\/.+\d+-/);
    }
  }
  assert.deepEqual(tally, {
    MAKE_CUSTOM_FASTENER: 8,
    BUY_STANDARD: 32,
    BUY_VERIFY_INTERFACE: 1,
    OEM_INCLUDED: 4,
  });
  assert.equal(
    model
      .filter((x) => /^18650 cell \d+ (disk|FC) insulating cup/.test(x.label))
      .every((x) => manufacturingMetadata(x).Procurement === 'MAKE_PRINT'),
    true,
  );
  assert.equal(
    model
      .filter((x) => /nickel/.test(x.label))
      .every((x) => manufacturingMetadata(x).Material === 'Ni200'),
    true,
  );
});

test('thread inventory preserves radial axes and contains both sides of cartridge threads', () => {
  const s = transform(rotate(screw(2, 6), 90, 'y'), 90, [4, 5, 6]);
  const ext = threadFeatures(s)[0],
    int = threadFeatures(matingHole(s))[0];
  assert.deepEqual(ext.origin, [4, 5, 6]);
  assert.deepEqual(
    ext.axis.map((v) => v || 0),
    [0, 1, 0],
  );
  assert.equal(ext.designation, int.designation);
  assert.equal(int.internal, true);
  const model = pieces(p, 'assembled');
  const barrel = threadFeatures(
    model.find((x) => x.label.startsWith('Threaded spring barrel'))!.shape,
  );
  assert.ok(barrel.some((x) => x.designation === 'M8×0.75 RH' && !x.internal && x.length === 3.5));
  assert.ok(barrel.some((x) => x.designation === 'M7×0.5 RH' && x.internal && x.length === 2));
  const disk = manufacturingMetadata(model.find((x) => x.label.startsWith('Nose servo and gear'))!);
  assert.match(disk.ThreadCallouts, /4× internal M8×0.75 RH/);
  assert.match(disk.ThreadCallouts, /8× internal M2.5×0.45 RH/);
  assert.match(disk.DrawingStatus, /DRAFT/);
});
