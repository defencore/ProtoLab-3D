import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import ball from "../src/parts/ball-bearing/part";
import cylindrical from "../src/parts/roller-bearing/part";
import selfAligning from "../src/parts/self-aligning-bearing/part";
import angular from "../src/parts/angular-contact-bearing/part";
import spherical from "../src/parts/spherical-roller-bearing/part";
import tapered from "../src/parts/tapered-roller-bearing/part";
import needle from "../src/parts/needle-bearing/part";
import doubleRow from "../src/parts/double-row-bearing/part";
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import { withSupplierPresets } from '../src/catalog/supplier-presets';

const families = [ball, cylindrical, selfAligning, angular, spherical, tapered, needle, doubleRow];

for (const part of families)
  test(`${part.id}: supplier envelope stays consistent in every assembly state`, () => {
    const presets =
      part === tapered
        ? withSupplierPresets(part).presets.filter((preset) =>
            ['-o5640/', '-o6650/'].some((suffix) => preset.catalog?.sourceUrl.endsWith(suffix)),
          )
        : part.presets.filter((preset) => preset.catalog);
    assert.ok(presets.length > 0, `${part.id}: source geometry fixtures must exist`);
    for (const preset of presets)
      for (const state of ['assembled', 'exploded']) {
        const p = preset.parameters;
        assert.deepEqual(validateParameters(part, p, state), [], `${preset.id}/${state}`);
        const model = part.buildGeometry(p, state);
        try {
          const size = new Box3().setFromObject(model).getSize(new Vector3()).toArray();
          part
            .dimensions(p, state)
            .forEach((value, axis) =>
              assert.ok(
                Math.abs(size[axis] - value) < 0.015,
                `${preset.id}/${state}: axis ${axis}`,
              ),
            );
          for (const child of model.children as Mesh[]) {
            const positions = child.geometry.getAttribute('position');
            for (const value of positions.array) assert.ok(Number.isFinite(value));
          }
        } finally {
          disposeModel(model);
        }
      }
  });

test('merged catalog excludes unresolved supplier dimensions and retains documented reconciliations', () => {
  const presets = families
    .flatMap((part) => withSupplierPresets(part).presets)
    .filter((p) => p.catalog);
  const report = JSON.parse(
    readFileSync(new URL('../data/promtehimport-import-report.json', import.meta.url), 'utf8'),
  ) as {
    results: { url: string; partId?: string; status: string; reason?: string }[];
  };
  const familyIds = new Set(families.map((part) => part.id));
  const rejected = report.results.filter(
    (entry) =>
      entry.partId &&
      familyIds.has(entry.partId) &&
      ['source-conflict', 'missing-dimensions', 'model-rejected'].includes(entry.status),
  );
  // These fixtures exercise missing total width and contradictory shaft diameters.
  assert.ok(
    rejected.some((entry) => entry.url.endsWith('-o1294/') && entry.reason === 'Missing width: T'),
  );
  assert.ok(
    rejected.some(
      (entry) => entry.url.endsWith('-o7041/') && entry.reason === 'Conflicting bore: 9 / 10',
    ),
  );
  const importedUrls = new Set(presets.map((preset) => preset.catalog!.sourceUrl));
  for (const entry of rejected) assert.equal(importedUrls.has(entry.url), false, entry.url);

  // Complete source pages and the NSK cross-reference resolved these former exclusions.
  for (const [suffix, dimensions] of [
    ['-o8227/', [10, 30, 9]],
    ['-o2043/', [12, 28, 8]],
    ['-o777/', [9, 13, 10]],
  ] as const) {
    const preset = presets.find((entry) => entry.catalog!.sourceUrl.endsWith(suffix));
    assert.ok(preset, suffix);
    assert.deepEqual(
      ['bore', 'outer', 'width'].map((key) => preset.parameters[key]),
      dimensions,
    );
  }
  const reconciled = presets.find((entry) => entry.catalog!.sourceUrl.endsWith('-o8227/'))!;
  assert.ok(
    reconciled.catalog!.alternateSourceUrls?.includes(
      'https://www.nsk.com/content/dam/nsk/am/en_us/documents/bearings-americas/Bearing-and-Linear-Replacement-Guide.pdf',
    ),
  );
  for (const preset of presets) {
    const verified = preset.catalog!.verifiedParameters;
    for (const key of ['bore', 'outer', 'width'])
      assert.ok(verified.includes(key), `${preset.id}: ${key}`);
    for (const key of verified) assert.ok(key in preset.parameters, `${preset.id}: ${key}`);
  }
});

test('tapered presets use total assembly width T and needle presets use the diameter under rollers Fw', () => {
  assert.equal(tapered.parameters.find((p) => p.key === 'width')?.symbol, 'T');
  const taperedPresets = withSupplierPresets(tapered).presets;
  assert.equal(
    taperedPresets.find((p) => p.catalog?.sourceUrl.endsWith('-o5640/'))?.parameters.width,
    13.25,
  );
  assert.equal(
    taperedPresets.find((p) => p.catalog?.sourceUrl.endsWith('-o6650/'))?.parameters.width,
    11.75,
  );
  assert.equal(needle.parameters.find((p) => p.key === 'bore')?.symbol, 'Fw');
  const model = needle.buildGeometry(needle.defaults, 'assembled');
  try {
    assert.equal(model.children.length, Number(needle.defaults.elements) + 2);
  } finally {
    disposeModel(model);
  }
});

test('double-row seals can be removed and angular shoulders respond to contact angle', () => {
  const closed = doubleRow.buildGeometry(doubleRow.defaults, 'assembled');
  const open = doubleRow.buildGeometry({ ...doubleRow.defaults, seals: 'open' }, 'assembled');
  try {
    assert.equal(closed.children.length, open.children.length + 2);
  } finally {
    disposeModel(closed);
    disposeModel(open);
  }
  assert.notEqual(
    angular.python({ ...angular.defaults, contactAngle: 15 }, 'assembled'),
    angular.python({ ...angular.defaults, contactAngle: 40 }, 'assembled'),
  );
  assert.ok(
    validateParameters(spherical, { ...spherical.defaults, elements: 64 }, 'assembled').length,
  );
  assert.ok(validateParameters(needle, { ...needle.defaults, outer: 6.1 }, 'assembled').length);
});

test('revolved races and rollers export outward closed meshes without collapsed cap triangles', () => {
  for (const part of [selfAligning, angular, spherical, tapered, needle, doubleRow]) {
    const model = part.buildGeometry(part.defaults, 'assembled');
    try {
      for (const mesh of model.children as Mesh[]) {
        const geometry = mesh.geometry,
          positions = geometry.getAttribute('position'),
          index = geometry.getIndex();
        let volume = 0;
        const edges = new Map<string, number>();
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const v = [i, i + 1, i + 2].map((j) =>
            new Vector3().fromBufferAttribute(positions, index ? index.getX(j) : j),
          );
          const area = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length();
          assert.ok(area > 1e-9, `${part.id}: triangle area`);
          volume += v[0].dot(v[1].clone().cross(v[2])) / 6;
          const keys = v.map((point) =>
            point
              .toArray()
              .map((value) => Math.round(value * 1e5))
              .join(','),
          );
          for (let side = 0; side < 3; side++) {
            const key = [keys[side], keys[(side + 1) % 3]].sort().join('|');
            edges.set(key, (edges.get(key) ?? 0) + 1);
          }
        }
        assert.ok(volume > 0, `${part.id}: outward winding`);
        for (const count of edges.values()) assert.equal(count, 2, `${part.id}: manifold edges`);
      }
    } finally {
      disposeModel(model);
    }
  }
});
