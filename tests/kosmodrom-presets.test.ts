import assert from 'node:assert/strict';
import test from 'node:test';
import snapshot from '../src/catalog/kosmodrom/m3-standoffs.json';
import { kosmodromPresets } from '../src/catalog/kosmodrom-presets';
import part from '../src/parts/pcb-standoff/part';
import {
  catalogFields,
  parameterSchema,
  prototypeDefaults,
} from '../src/parts/pcb-standoff/lib/schema';
import { pieces, validateStandoff } from '../src/parts/pcb-standoff/lib/model';
import { registerPartModules } from '../src/core/part-modules';

const presets = kosmodromPresets();
const model = (name: string) => presets.find((preset) => preset.name === name)!;
const specifications = (name: string) => JSON.stringify(model(name).catalog!.specifications);

test('all 126 Kosmodrom supplier identities retain exact SKU, URL, page hash and fixed schema', () => {
  assert.equal(presets.length, 126);
  assert.equal(new Set(presets.map((preset) => preset.id)).size, 126);
  assert.equal(new Set(presets.map((preset) => preset.parameters.catalogItem)).size, 126);
  assert.equal(new Set(presets.map((preset) => preset.catalog!.sourceUrl)).size, 126);
  const schemaKeys = parameterSchema(presets)
    .map((field) => field.key)
    .sort();
  for (const source of snapshot.products) {
    const preset = presets.find((candidate) => candidate.id === `kosmodrom-${source.sku}`)!;
    assert.equal(preset.name, source.model);
    assert.equal(preset.parameters.catalogItem, preset.id);
    assert.equal(preset.catalog!.sourceUrl, source.url);
    assert.equal(preset.catalog!.geometryEvidence!.sourceSha256, source.sourceSha256);
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'envelope');
    assert.deepEqual(preset.catalog!.productCodes, [source.sku]);
    assert.equal(preset.catalog!.manufacturer, source.manufacturer ?? undefined);
    assert.deepEqual(Object.keys(preset.parameters).sort(), schemaKeys);
    assert.deepEqual(validateStandoff(preset.parameters, presets), [], source.model);
    assert.equal(preset.parameters.femaleDepthA, 0);
    assert.equal(preset.parameters.femaleDepthB, 0);
    for (const field of [
      'femaleEnvelopeDepthA',
      'femaleEnvelopeDepthB',
      'maleEnvelopeLengthA',
      'maleEnvelopeLengthB',
      'threadPitchA',
      'threadPitchB',
    ])
      assert.ok(!preset.catalog!.verifiedParameters.includes(field), `${source.model}: ${field}`);
    assert.equal(
      preset.catalog!.attributes!.catalogBodyLength,
      source.parameters.bodyLength ?? undefined,
    );
    assert.equal(
      preset.catalog!.attributes!.catalogBodyWidth,
      source.parameters.bodyWidth ?? undefined,
    );
    assert.equal(
      preset.catalog!.attributes!.catalogCornerDiameter,
      source.parameters.cornerDiameter ?? undefined,
    );
  }
  assert.equal(Object.hasOwn(model('TFF-M3X10').catalog!, 'manufacturer'), false);
  assert.equal(model('TFF-M3X7').catalog!.manufacturer, 'KLS');
  assert.deepEqual(Object.keys(prototypeDefaults).sort(), schemaKeys);
  const registered = registerPartModules([
    {
      apiVersion: 2,
      order: 1,
      part: {
        ...part,
        parameters: parameterSchema(presets),
        presets,
        defaults: presets[0].parameters,
        catalogFilterFields: catalogFields(presets),
      },
    },
  ]);
  assert.equal(registered[0].presets.length, 126);
});

test('unpublished female depth and interpreted ISO pitch never become supplier-verified dimensions', () => {
  for (const preset of presets) {
    assert.equal(preset.catalog!.attributes!.threadLabel, 'M3');
    assert.match(
      preset.catalog!.attributeConditions!.threadLabel,
      /ISO metric coarse interpretation/,
    );
    assert.match(preset.catalog!.geometryEvidence!.limitations, /not a verified supplier pitch/);
    for (const side of ['A', 'B']) {
      assert.equal(preset.parameters[`threadPitch${side}`], 0.5);
      assert.equal(preset.parameters[`threadDiameter${side}`], 3);
      assert.equal(preset.parameters[`threadDesignation${side}`], 'M3');
      if (preset.parameters[`end${side}`] === 'female') {
        assert.ok(Number(preset.parameters[`femaleEnvelopeDepth${side}`]) > 0);
        assert.equal(preset.parameters[`femaleDepth${side}`], 0);
        assert.match(JSON.stringify(preset.catalog!.specifications), /not a manufacturing depth/);
      }
    }
  }
  assert.ok(!model('TFM-B-M3X12').catalog!.verifiedParameters.includes('endB'));
  assert.equal(model('TFM-B-M3X12').catalog!.attributes!.endForm, undefined);
  assert.equal(model('TFM-Ni-M3X10').catalog!.attributes!.bodyForm, undefined);
});

test('disputed TFM25 and unknown studs are qualified smooth envelopes with no invented thread spans', () => {
  const disputed = model('TFM-M3X25');
  assert.equal(disputed.parameters.bodyLength, 25);
  assert.equal(disputed.parameters.maleLengthB, 0);
  assert.equal(disputed.parameters.maleEnvelopeLengthB, 6);
  assert.equal(disputed.catalog!.attributes!.catalogBodyLength, undefined);
  assert.ok(!disputed.catalog!.verifiedParameters.includes('bodyLength'));
  assert.ok(!disputed.catalog!.verifiedParameters.includes('maleLengthB'));
  assert.match(String(disputed.catalog!.attributes!.modelFidelity), /conflict/);
  assert.match(disputed.catalog!.attributeConditions!.modelFidelity, /31 mm/);
  assert.match(specifications('TFM-M3X25'), /not a verified body length/);
  const features = JSON.parse(pieces(disputed.parameters)[0].metadata.ThreadFeatures ?? '[]');
  assert.deepEqual(
    features,
    [],
    'illustrative female openings and male projection have no manufacturing thread features',
  );
  const unknown = model('TFM-M3X10');
  assert.equal(unknown.parameters.maleLengthB, 0);
  assert.equal(unknown.parameters.maleEnvelopeLengthB, 6);
  assert.match(specifications('TFM-M3X10'), /Unpublished stud length/);
});

test('overall minus designation body gives an explicit derived 6 mm stud without publishing inferred filter dimensions', () => {
  for (const [name, body, overall] of [
    ['TFM-M3X20', 20, 26],
    ['TFM-M3X40', 40, 46],
    ['TFM-M3X50', 50, 56],
  ] as const) {
    const preset = model(name);
    assert.equal(preset.parameters.bodyLength, body);
    assert.equal(preset.parameters.maleLengthB, 6);
    assert.equal(preset.parameters.maleEnvelopeLengthB, 0);
    assert.ok(!preset.catalog!.verifiedParameters.includes('maleLengthB'));
    assert.ok(!preset.catalog!.verifiedParameters.includes('bodyLength'));
    assert.equal(preset.catalog!.attributes!.catalogBodyLength, undefined);
    assert.match(
      specifications(name),
      new RegExp(`published overall ${overall} mm - commercial-designation body ${body} mm`),
    );
  }
  const direct = model('TMM-M3X10');
  assert.equal(direct.parameters.maleLengthA, 6);
  assert.equal(direct.parameters.maleLengthB, 6);
  assert.ok(direct.catalog!.verifiedParameters.includes('maleLengthA'));
  assert.ok(direct.catalog!.verifiedParameters.includes('maleLengthB'));
  const derived = model('TFM-M3X15');
  assert.equal(derived.parameters.maleLengthB, 6);
  assert.ok(!derived.catalog!.verifiedParameters.includes('maleLengthB'));
  assert.match(specifications('TFM-M3X15'), /overall 21 mm - body 15 mm/);
});

test('published AF/H clipping and explicit variant AF override remain visible and distinct', () => {
  const clipped = model('TFF-M3X10');
  assert.equal(clipped.parameters.bodyWidth, 5);
  assert.equal(clipped.parameters.cornerDiameter, 5.5);
  assert.equal(clipped.catalog!.attributes!.catalogCornerDiameter, 5.5);
  assert.ok(clipped.catalog!.verifiedParameters.includes('cornerDiameter'));
  assert.match(clipped.catalog!.attributeConditions!.catalogCornerDiameter, /\+0\/-0\.2/);
  assert.ok(
    clipped.catalog!.alternateSourceUrls!.includes('https://kosmodrom.ua/storage/pdf/KLS8-DBK.pdf'),
  );
  const variant = model('TFM-M3X8');
  assert.equal(variant.parameters.bodyWidth, 4.5);
  assert.equal(variant.parameters.cornerDiameter, 0);
  assert.equal(variant.catalog!.attributes!.catalogBodyWidth, 4.5);
  assert.equal(variant.catalog!.attributes!.catalogCornerDiameter, undefined);
  assert.ok(!variant.catalog!.verifiedParameters.includes('cornerDiameter'));
  assert.match(variant.catalog!.attributeConditions!.modelFidelity, /4\.5 mm/);
  assert.match(variant.catalog!.attributeConditions!.modelFidelity, /5 mm/);
});
