import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Group } from 'three';
import type { PartDefinition } from '../src/core/types';
import { caseParameters, planCases } from '../scripts/library-script-audit/cases';

const fixture: PartDefinition = {
  id: 'audit-fixture',
  name: 'Audit fixture',
  category: 'Tests',
  subgroup: 'Audit',
  icon: 'box',
  complexity: 'One detail',
  description: 'A constrained fixture for audit coverage.',
  product: {
    kind: 'detail',
    supply: 'manufactured',
    description: 'Fixture',
    processes: ['milling'],
    releaseRequirements: ['Review fixture drawing.'],
  },
  keywords: [],
  parameters: [{ key: 'length', label: 'Length', type: 'number', group: 'Size', min: 0, max: 20 }],
  defaults: { length: 10 },
  presets: [{ id: 'sku12', name: 'Twelve', description: 'Fixture', parameters: { length: 12 } }],
  states: [
    { id: 'assembled', label: 'Assembly', description: 'Physical position' },
    { id: 'exploded', label: 'Inspection', description: 'Separated detail' },
  ],
  validate: (p) => (Number(p.length) > 0 ? [] : ['Length must be positive.']),
  buildGeometry: () => new Group(),
  python: () => 'shape = Part.makeBox(10,2,3)',
  dimensions: () => [10, 2, 3],
};

test('library audit includes every authored default state in both modes and compiles every catalog macro', () => {
  const cases = planCases([fixture], {
    phases: ['syntax', 'native'],
    modes: ['simple', 'full'],
    presets: true,
    states: 'all',
    extrema: 1,
  });
  assert.equal(cases.length, 12);
  assert.equal(new Set(cases.map((item) => item.key)).size, cases.length);
  for (const phase of ['syntax', 'native'])
    for (const mode of ['simple', 'full'])
      assert.deepEqual(
        cases
          .filter(
            (item) => item.phase === phase && item.mode === mode && item.variant === 'default',
          )
          .map((item) => item.state),
        ['assembled', 'exploded'],
      );
  assert.deepEqual(
    cases.filter((item) => item.presetId).map((item) => [item.phase, item.mode, item.state]),
    [
      ['syntax', 'simple', 'assembled'],
      ['syntax', 'full', 'assembled'],
    ],
  );
  assert.ok(cases.filter((item) => item.patch).every((item) => item.phase === 'native'));
});

test('library extrema reject invalid boundaries and preserve source defaults and fixed catalog configurations', () => {
  const source = JSON.stringify(fixture.defaults);
  const cases = planCases([fixture], {
    phases: ['native'],
    modes: ['simple'],
    presets: false,
    states: 'first',
    extrema: 2,
  });
  assert.deepEqual(
    cases.map((item) => item.variant),
    ['default', 'length-max'],
  );
  assert.deepEqual(caseParameters(fixture, cases[1]), { length: 20 });
  assert.equal(JSON.stringify(fixture.defaults), source);
  const fixed = planCases([{ ...fixture, catalogSelectionOnly: true }], {
    phases: ['native'],
    modes: ['simple'],
    presets: false,
    states: 'first',
    extrema: 2,
  });
  assert.deepEqual(
    fixed.map((item) => item.variant),
    ['default'],
  );
  assert.throws(
    () => caseParameters(fixture, { ...cases[0], presetId: 'missing' }),
    /Unknown audit preset/,
  );
});

test('audit CLI recycles workers, resumes identical macros and reruns changed hashes or previous failures', () => {
  const directory = mkdtempSync(join(tmpdir(), 'library-audit-resume-')),
    reportPath = join(directory, 'report.json'),
    script = fileURLToPath(new URL('../scripts/audit-library-scripts.ts', import.meta.url));
  const run = (resume = false) => {
    const child = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        script,
        '--phase',
        'syntax',
        '--parts',
        'washer',
        '--modes',
        'simple,full',
        '--states',
        'first',
        '--extrema',
        '0',
        '--no-presets',
        '--jobs',
        '1',
        '--worker-cases',
        '1',
        '--report',
        reportPath,
        ...(resume ? ['--resume'] : []),
      ],
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    assert.equal(child.status, 0, `${child.error ?? ''}\n${child.stdout}\n${child.stderr}`);
    return JSON.parse(readFileSync(reportPath, 'utf8'));
  };
  try {
    const initial = run();
    assert.equal(initial.completed, 2);
    assert.deepEqual(initial.active, {});
    assert.deepEqual(initial.counts, { passed: 2, failed: 0, timeout: 0, reused: 0 });
    assert.equal(initial.scope.workerCaseLimit, 1);
    // An interrupted recheck must retain successful cases that it had not
    // visited yet, while keeping them out of the current-source pass counter.
    const interrupted = JSON.parse(readFileSync(reportPath, 'utf8')),
      unvisited = Object.keys(interrupted.results)[1];
    interrupted.resumeCache = { [unvisited]: interrupted.results[unvisited] };
    delete interrupted.results[unvisited];
    interrupted.completed = 1;
    interrupted.counts.passed = 1;
    writeFileSync(reportPath, JSON.stringify(interrupted));
    assert.equal(run(true).counts.reused, 2);

    const changed = JSON.parse(readFileSync(reportPath, 'utf8')),
      key = Object.keys(changed.results)[0];
    changed.results[key].sourceHash = 'a different macro';
    writeFileSync(reportPath, JSON.stringify(changed));
    const regenerated = run(true);
    assert.equal(regenerated.counts.reused, 1);
    assert.equal(regenerated.results[key].sourceHash, initial.results[key].sourceHash);

    regenerated.results[key].status = 'failed';
    regenerated.results[key].error = 'A previous execution failed.';
    writeFileSync(reportPath, JSON.stringify(regenerated));
    const corrected = run(true);
    assert.deepEqual(corrected.counts, { passed: 2, failed: 0, timeout: 0, reused: 1 });
    assert.equal(corrected.results[key].error, undefined);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
