import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { Box3 } from 'three';
import previous, { actuatorPieces, actuatorLayout } from '../src/parts/sfk-slotted-actuator/part';
import previousModule from '../src/parts/sfk-slotted-actuator/index';
import trunnion from '../src/parts/sfk-rotary-actuator/part';
import { parts } from '../src/parts';
import { disposeModel } from '../src/core/mechanical';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';

interface PriorSnapshot {
  neutralComponentsSha256: string;
  appearanceSha256: string;
  sourcePalettesSha256: string;
  cases: {
    name: string;
    parameters: Parameters;
    sourceConfigurationsSha256: string;
    pieces: { id: string; min: number[]; max: number[] }[];
  }[];
}
const snapshot: PriorSnapshot = JSON.parse(
  readFileSync(new URL('./fixtures/sfk-slotted-previous.json', import.meta.url), 'utf8'),
);
const digest = (value: unknown) =>
  createHash('sha256')
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]]),
            )
          : item,
      ),
    )
    .digest('hex');

test('previous slotted and current trunnion assemblies remain independent registered items', () => {
  for (const definition of [previous, trunnion]) {
    const matches = parts.filter((part) => part.id === definition.id);
    assert.equal(matches.length, 1, definition.id);
    assert.equal(matches[0].name, definition.name);
  }
  assert.notEqual(previous.id, trunnion.id);
  assert.ok(!previousModule.dependencies.includes(trunnion.id));
  const checkImports = (directory: URL) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) checkImports(path);
      else if (entry.name.endsWith('.ts'))
        assert.doesNotMatch(
          readFileSync(path, 'utf8'),
          /['"][^'"\n]*\/sfk-rotary-actuator(?:\/|['"])/,
          'The preserved assembly must own its geometry and motion implementation.',
        );
    }
  };
  checkImports(new URL('../src/parts/sfk-slotted-actuator/', import.meta.url));
});

test('previous neutral recipes, procurement identities and source colors match the released assembly', () => {
  const pieces = actuatorPieces(previous.defaults);
  assert.equal(pieces.length, 76);
  assert.equal(digest(pieces.map((piece) => piece.component)), snapshot.neutralComponentsSha256);
  assert.equal(
    digest(
      pieces.map((piece) => ({
        id: piece.component.id,
        color: piece.color,
        preserveLibraryAppearance: Boolean(piece.preserveLibraryAppearance),
      })),
    ),
    snapshot.appearanceSha256,
  );
  const source = withGeometryMode('simple', () => previous.python(previous.defaults, 'assembled'));
  const sourcePalettes = [...source.matchAll(/^scope = _actuator_source\((".*")\)$/gm)].map(
    (match) =>
      (JSON.parse(match[1]) as string)
        .split('\n')
        .filter((line) => /^component_colors\s*=/.test(line)),
  );
  assert.equal(sourcePalettes.length, 76);
  assert.equal(digest(sourcePalettes), snapshot.sourcePalettesSha256);
});

test('previous slotted-crank law stays continuous with a fixed screw axis throughout ±20°', () => {
  for (let angle = -20; angle <= 20; angle += 0.25) {
    const radians = (angle * Math.PI) / 180;
    const motion = actuatorLayout({ ...previous.defaults, outputAngle: angle });
    assert.ok(Math.abs(motion.displacement - 12.2 * Math.tan(radians)) < 1e-12);
    assert.ok(Math.abs(motion.center - 14.5 - motion.displacement) < 1e-12);
    assert.ok(Math.abs(motion.rollerRadius - 12.2 / Math.cos(radians)) < 1e-12);
    assert.deepEqual(motion.pivot, [14.5, 0, 15.8]);
    assert.deepEqual(motion.pin, [motion.center, 17.5, 28]);
    assert.ok(
      Math.abs(
        motion.displacement -
          (motion.rotation * 2.5) / 360 -
          ((motion.nutPosition - 50) * 22) / 100,
      ) < 1e-12,
      'Wrapped screw phase and nut setting must preserve continuous travel.',
    );
  }
  assert.equal(actuatorLayout(previous.defaults, 'negative-limit').angle, -20);
  assert.equal(actuatorLayout(previous.defaults, 'positive-limit').angle, 20);
});

for (const expected of snapshot.cases)
  test(`preserved preview and native source settings match ${expected.name}`, () => {
    const pieces = actuatorPieces(expected.parameters);
    const sourceConfigurations = pieces
      .filter((piece) => piece.component.libraryId !== 'manufactured-detail')
      .map((piece) => ({
        id: piece.component.id,
        libraryId: piece.component.libraryId,
        parameters: piece.component.parameters,
      }));
    assert.equal(digest(sourceConfigurations), expected.sourceConfigurationsSha256);
    const screw = pieces.find((piece) => piece.component.id === 'ball-screw')!.component;
    assert.deepEqual(screw.placement, { translation: [0, 0, 28], rotation: [0, 90, 0] });
    const model = withGeometryMode('simple', () =>
      previous.buildGeometry(expected.parameters, 'assembled'),
    );
    model.updateMatrixWorld(true);
    try {
      assert.equal(model.children.length, expected.pieces.length);
      expected.pieces.forEach((before, index) => {
        assert.equal(pieces[index].component.id, before.id);
        const bounds = new Box3().setFromObject(model.children[index], true);
        const actual = [...bounds.min.toArray(), ...bounds.max.toArray()];
        const previousBounds = [...before.min, ...before.max];
        actual.forEach((value, coordinate) =>
          assert.ok(
            Number.isFinite(value) && Math.abs(value - previousBounds[coordinate]) < 1e-5,
            `${before.id}: bound ${coordinate} differs from the preserved assembly.`,
          ),
        );
      });
    } finally {
      disposeModel(model);
    }
  });
