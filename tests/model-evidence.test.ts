import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parts } from '../src/parts';
import { modelEvidence, presetEvidence } from '../src/core/model-evidence';
import { generateScript } from '../src/core/freecad';

test('every preset has conservative geometry evidence, separate from catalog identity', () => {
  for (const part of parts)
    for (const preset of part.presets) {
      const evidence = presetEvidence(part, preset);
      assert.ok(
        evidence.label && evidence.summary && evidence.limitations,
        `${part.id}/${preset.id}`,
      );
      if (evidence.kind === 'manufacturer-cad' || evidence.kind === 'community-cad') {
        assert.equal(preset.catalog?.geometryEvidence?.kind, evidence.kind);
        assert.match(evidence.sourceSha256!, /^[a-f0-9]{64}$/);
      } else if (!preset.catalog) assert.equal(evidence.kind, 'parametric');
    }
  const esp = parts.find((p) => p.id === 'esp32')!;
  assert.equal(
    modelEvidence(esp, esp.defaults).kind,
    'source-dimensions',
    'sourced model identity alone is not manufacturer geometry',
  );
  const bearing = parts.find((p) => p.id === 'ball-bearing')!;
  const stock = bearing.presets.find((p) => p.catalog)!;
  const custom = { ...stock.parameters, width: 12.345678 };
  assert.equal(
    modelEvidence(bearing, custom).kind,
    'parametric',
    'custom geometry must lose the source comparison',
  );
  const bec = parts.find((p) => p.id === 'bec')!;
  assert.equal(modelEvidence(bec, bec.defaults).kind, 'envelope');
});

test('community connector CAD and authored XH models retain distinct provenance classes', () => {
  const connector = parts.find((part) => part.id === 'signal-connector')!;
  const authored = connector.presets.filter((preset) => preset.id.startsWith('xh254-'));
  const community = connector.presets.filter((preset) => !preset.id.startsWith('xh254-'));
  assert.equal(community.length, 36);
  assert.deepEqual(
    authored.map((preset) => preset.id),
    [
      'xh254-balance-header-4',
      'xh254-balance-header-5',
      'xh254-balance-header-ra-4',
      'xh254-balance-header-ra-5',
    ],
  );
  assert.equal(community.length + authored.length, connector.presets.length);
  for (const preset of community) {
    assert.equal(preset.catalog!.geometryEvidence!.kind, 'community-cad');
    const evidence = modelEvidence(connector, preset.parameters, preset.id);
    assert.equal(evidence.kind, 'community-cad');
    assert.equal(evidence.label, 'Community CAD');
    assert.match(evidence.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.equal(evidence.source, preset.catalog!.geometryEvidence!.sourceUrl);
  }
  for (const preset of authored) {
    const declared = preset.catalog!.geometryEvidence!;
    const evidence = modelEvidence(connector, preset.parameters, preset.id);
    assert.equal(declared.kind, 'envelope');
    assert.equal(evidence.kind, 'envelope');
    assert.equal(evidence.label, 'Envelope model');
    assert.match(evidence.summary, /authored/i);
    assert.match(evidence.limitations, /authored estimates/);
    assert.match(evidence.limitations, /verify the delivered/i);
    assert.match(evidence.sourceSha256!, /^[a-f0-9]{64}$/);
    assert.equal(evidence.source, declared.sourceUrl);
  }
  const first = community[0];
  const withoutExplicitEvidence = {
    ...connector,
    presets: [{ ...first, catalog: { ...first.catalog!, geometryEvidence: undefined } }],
  };
  assert.equal(
    modelEvidence(withoutExplicitEvidence, first.parameters).kind,
    'source-dimensions',
    'A community source name alone must not imply imported geometry provenance',
  );
});

test('native board metadata pins original source assets and exports scope', () => {
  const cases = [
    ['raspberry-pi', 'raspberry-pi-5-full', 'pi5'],
    ['nrf52840', 'adafruit-feather-nrf52840', 'feather'],
  ];
  for (const [id, model, folder] of cases) {
    const part = parts.find((p) => p.id === id)!;
    const preset = part.presets.find((p) => p.id === model)!;
    const native = JSON.parse(readFileSync(`src/parts/${id}/lib/${folder}/native.json`, 'utf8'));
    assert.equal(modelEvidence(part, preset.parameters).sourceSha256, native.sourceSha256);
    assert.match(generateScript(part, preset.parameters, 'assembled'), /GeometryEvidence/);
  }
  const feather = parts
    .find((p) => p.id === 'nrf52840')!
    .presets.find((p) => p.id === 'adafruit-feather-nrf52840')!;
  // Pinned original STEP revision; runtime retains the baked BREP and its source hash.
  const sha = '77f9e8d9deba17aee67a93ea8fe38eb4aea36aa4d70febbff5465d9b83be4975';
  assert.equal(feather.catalog!.geometryEvidence!.sourceSha256, sha);
  assert.equal(feather.catalog!.attributes!.width, 22.86);
  assert.equal(feather.catalog!.attributes!.length, 50.8);
  assert.equal(feather.catalog!.attributes!.height, 6.99);
});

test('identical dimensions preserve the explicitly selected source in UI and export', () => {
  const part = parts.find((p) => p.id === 'esp32')!;
  const first = part.presets[0];
  const alternative = {
    ...first,
    id: 'source-revision-b',
    catalog: {
      ...first.catalog!,
      sourceUrl: 'https://example.test/revision-b',
      geometryEvidence: undefined,
    },
  };
  const fixture = { ...part, presets: [first, alternative] };
  assert.equal(
    modelEvidence(fixture, first.parameters, alternative.id).source,
    alternative.catalog.sourceUrl,
  );
  const script = generateScript(fixture, first.parameters, 'assembled', alternative.id);
  assert.match(script, /obj.CatalogSource = "https:\/\/example.test\/revision-b"/);
});
