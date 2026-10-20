import assert from 'node:assert/strict';
import test from 'node:test';
import sourceData from '../src/catalog/dremec/standoffs.json';
import { dremecPresets } from '../src/catalog/dremec-presets';
import { prototypeDefaults, insertPrototypeDefaults } from '../src/parts/pcb-standoff/lib/schema';
import { validateStandoff } from '../src/parts/pcb-standoff/lib/model';
import type { Preset } from '../src/core/types';

const groups = dremecPresets();
const all = [...groups.detail, ...groups.insert];
function selected(sku: string): Preset {
  const preset = all.find((value) => value.name === sku);
  assert.ok(preset, sku);
  return preset;
}
function verified(preset: Preset, key: string): boolean {
  return preset.catalog!.verifiedParameters.includes(key);
}

test('DREMEC exposes every source code plus exactly the 68 separate short-k codes, with stable supplier identity', () => {
  assert.equal(groups.detail.length, 3315);
  assert.equal(groups.insert.length, 1003);
  assert.equal(all.length, 4318);
  assert.equal(new Set(all.map((value) => value.id)).size, all.length);
  assert.equal(new Set(all.map((value) => value.name)).size, all.length);
  assert.equal(all.filter((value) => value.name.endsWith('k')).length, 68);
  const sourceBySku = new Map(sourceData.records.map((record) => [record.sku, record]));
  for (const preset of all) {
    const sourceSku = preset.name.endsWith('k') ? preset.name.slice(0, -1) : preset.name;
    const source = sourceBySku.get(sourceSku);
    assert.ok(source, preset.name);
    assert.equal(preset.catalog!.sourceUrl, source.supplierUrl);
    assert.deepEqual(preset.catalog!.productCodes, [preset.name]);
    assert.equal(preset.catalog!.designation, preset.name);
    assert.equal(preset.parameters.catalogItem, preset.id);
    assert.equal(preset.parameters.bodyLength, source.bodyLength);
    assert.equal(preset.parameters.bodyWidth, source.acrossFlats ?? source.bodyDiameter);
    assert.equal(preset.catalog!.geometryEvidence!.sourceSha256, sourceData.sourceSha256);
    assert.equal(preset.catalog!.geometryEvidence!.sourceUrl, source.drawingUrl);
    assert.ok(
      preset.catalog!.specifications!.some(
        (value) => value.label === 'UA product family' && /unconfirmed/.test(value.value),
      ),
    );
    assert.ok(preset.catalog!.attributeConditions!.modelFidelity.length > 0);
    assert.ok(!('catalogCornerDiameter' in preset.catalog!.attributes!));
    assert.equal(preset.product!.supply, 'purchased');
  }
});

test('short-k variants preserve their real 6 mm stud and independent selection without changing the default 8 mm source code', () => {
  for (const prefix of ['213', '214', '413', '414']) {
    const standard = selected(`${prefix}x10`),
      short = selected(`${prefix}x10k`);
    assert.notEqual(standard.id, short.id);
    assert.equal(standard.parameters.maleLengthB, 8);
    assert.equal(short.parameters.maleLengthB, 6);
    assert.ok(verified(short, 'maleLengthB'));
    if (prefix.startsWith('4')) {
      assert.equal(standard.parameters.maleLengthA, 8);
      assert.equal(short.parameters.maleLengthA, 6);
    }
    assert.ok(short.catalog!.alternateSourceUrls!.some((url) => /#page=4$/.test(url)));
  }
  assert.ok(
    !all.some(
      (preset) =>
        preset.name.endsWith('oF') || preset.name.endsWith('bl') || preset.name.endsWith('A2'),
    ),
  );
});

test('standard-derived pitches stay unverified while mixed UNC and actual external self-tapping source diameters stay distinct', () => {
  const metric = selected('2112x10');
  assert.equal(metric.parameters.threadDiameterA, 2.5);
  assert.equal(metric.parameters.threadPitchA, 0.45);
  assert.ok(verified(metric, 'threadDiameterA'));
  assert.ok(!verified(metric, 'threadPitchA'));
  const mixed = selected('2103x5/12');
  assert.ok(Math.abs(Number(mixed.parameters.threadDiameterA) - 2.8448) < 1e-12);
  assert.equal(mixed.parameters.threadPitchA, 25.4 / 40);
  assert.equal(mixed.parameters.threadDiameterB, 3);
  assert.equal(mixed.parameters.threadPitchB, 0.5);
  assert.equal(mixed.parameters.threadDesignationA, 'UNC4-40');
  assert.equal(mixed.parameters.threadDesignationB, 'M3');
  assert.ok(!verified(mixed, 'threadDiameterA'));
  assert.ok(!verified(mixed, 'threadPitchA'));
  assert.match(mixed.catalog!.attributeConditions!.threadLabel, /standard-derived/);
  const external = selected('214ST2.9x10');
  assert.equal(external.parameters.endA, 'female');
  assert.equal(external.parameters.endB, 'male');
  assert.equal(external.parameters.threadDiameterB, 2.8);
  assert.equal(external.parameters.threadRootDiameterB, 2.1);
  assert.equal(external.parameters.threadPitchB, 0);
  assert.equal(external.parameters.threadDesignationB, 'ST2.9');
  assert.ok(verified(external, 'threadDiameterB'));
  assert.ok(verified(external, 'threadRootDiameterB'));
  assert.ok(!verified(external, 'threadPitchB'));
  for (const preset of all)
    assert.ok(!verified(preset, 'threadPitchA') && !verified(preset, 'threadPitchB'), preset.id);
});

test('unknown openings and studs use explicitly unverified envelopes; source half-depth spans keep both end definitions', () => {
  const unknownDepth = selected('113x25');
  for (const side of ['A', 'B']) {
    assert.equal(unknownDepth.parameters[`femaleDepth${side}`], 0);
    assert.equal(unknownDepth.parameters[`femaleEnvelopeDepth${side}`], 2);
    assert.ok(!verified(unknownDepth, `femaleDepth${side}`));
    assert.ok(!verified(unknownDepth, `femaleEnvelopeDepth${side}`));
  }
  assert.equal(unknownDepth.catalog!.geometryEvidence!.kind, 'envelope');
  const unknownStud = selected('432x10');
  for (const side of ['A', 'B']) {
    assert.equal(unknownStud.parameters[`maleLength${side}`], 0);
    assert.equal(unknownStud.parameters[`maleEnvelopeLength${side}`], 6);
    assert.ok(!verified(unknownStud, `maleLength${side}`));
    assert.ok(!verified(unknownStud, `maleEnvelopeLength${side}`));
  }
  const meeting = selected('113x18');
  assert.equal(meeting.parameters.femaleDepthA, 9);
  assert.equal(meeting.parameters.femaleDepthB, 9);
  assert.equal(meeting.parameters.meetingFemaleBores, true);
  assert.equal(meeting.parameters.threadedThrough, false);
  assert.ok(verified(meeting, 'femaleDepthA') && verified(meeting, 'femaleDepthB'));
  assert.ok(verified(meeting, 'meetingFemaleBores'));
  const through = selected('110x12');
  assert.equal(through.parameters.threadedThrough, true);
  assert.equal(through.parameters.femaleDepthA, 0);
  assert.equal(through.parameters.femaleDepthB, 0);
});

test('composite internal inserts remain unknown while the actual outer brass stud span and material conflict stay visible', () => {
  const composite = selected('2183x30');
  for (const key of ['insertOuterDiameter', 'insertLengthA', 'insertLengthB']) {
    assert.equal(composite.parameters[key], 0);
    assert.ok(!verified(composite, key));
  }
  assert.equal(composite.parameters.insertThrough, false);
  assert.equal(composite.parameters.maleLengthB, 8);
  assert.ok(verified(composite, 'maleLengthB'));
  assert.equal(composite.parameters.femaleDepthA, 6);
  assert.ok(verified(composite, 'femaleDepthA'));
  assert.equal(composite.catalog!.geometryEvidence!.kind, 'envelope');
  assert.ok(
    composite.catalog!.specifications!.some(
      (value) => value.label === 'Length tolerance' && /0.2/.test(value.value),
    ),
  );
  const conflicted = selected('285x30');
  assert.match(conflicted.catalog!.attributeConditions!.material, /6\.0 GV.*6\.6/);
});

test('all generated DREMEC presets satisfy the actual per-end model contract and never mutate defaults or share configuration objects', () => {
  const detailDefaults = structuredClone(prototypeDefaults),
    insertDefaults = structuredClone(insertPrototypeDefaults);
  for (const [presets, composite] of [
    [groups.detail, false],
    [groups.insert, true],
  ] as const)
    for (const preset of presets)
      assert.deepEqual(validateStandoff(preset.parameters, [preset], composite), [], preset.id);
  const regenerated = dremecPresets();
  assert.deepEqual(regenerated, groups);
  assert.notEqual(regenerated.detail[0].parameters, groups.detail[0].parameters);
  assert.deepEqual(prototypeDefaults, detailDefaults);
  assert.deepEqual(insertPrototypeDefaults, insertDefaults);
});
