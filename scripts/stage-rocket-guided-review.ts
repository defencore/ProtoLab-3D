/** Freeze the selected live guided preset, physical identities and actual print poses for review. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import part, { configuredPieces, libraries } from '../src/parts/rocket-camera-nose/part';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import { componentGeometry } from '../src/core/assembly/detail-instances';
import { disposeModel } from '../src/core/mechanical';
import { Box3, Mesh, Vector3 } from 'three';

const args = process.argv.slice(2);
const value = (name: string, fallback?: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const specPath = value('--spec');
assert.ok(
  specPath,
  'Supply --spec <JSON> with explicit moving groups, stage obstacles and tool/PCB approaches.',
);
const output = resolve(value('--out', 'test-results/rocket-camera-nose-guided-rebuild/current')!);
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
assert.equal(spec.schemaVersion, 1);
assert.equal(spec.units, 'mm');
const preset = part.presets.find((p) => p.id === spec.presetId);
assert.ok(preset);
const parameters = { ...preset.parameters };
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
const records = [];
mkdirSync(output, { recursive: true });

const nativeOnly = args.includes('--native-only');
for (const state of nativeOnly ? ['assembled'] : ['assembled', 'print-layout']) {
  assert.deepEqual(validateParameters(part, parameters, state), [], state);
  await part.initializeGeometry?.(parameters, state);
  const pieces = configuredPieces(parameters, state);
  assert.equal(new Set(pieces.map((p) => p.component.id)).size, pieces.length);
  const components = pieces.map((piece) => ({
    ...piece.component,
    requireSingleSolid:
      piece.requireSingleSolid ||
      piece.component.manufacturing?.processes.includes('printing') ||
      false,
    inspectionPose: { position: piece.position ?? [0, 0, piece.z ?? 0], angle: piece.angle ?? 0 },
  }));
  const macro = generateScript(part, parameters, state, preset.id);
  const filename = state + '.FCMacro';
  writeFileSync(resolve(output, filename), macro);
  const meshChecks = [];
  for (const piece of pieces) {
    if (nativeOnly || !piece.component.manufacturing?.processes.includes('printing')) continue;
    let model: ReturnType<typeof componentGeometry> | undefined;
    try {
      model = componentGeometry(libraries, [piece]);
      model.updateMatrixWorld(true);
      const bounds = new Box3().setFromObject(model, true);
      assert.ok(!bounds.isEmpty());
      let triangles = 0;
      const edges = new Map<string, { count: number; direction: number }>();
      let signedVolume = 0;
      let collapsedEdges = 0;
      const pointKey = (p: Vector3) =>
        p
          .toArray()
          .map((v) => Math.round(v * 1e7))
          .join(',');
      model.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        const index = object.geometry.index;
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
          const vertices = [0, 1, 2].map((offset) =>
            new Vector3()
              .fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset)
              .applyMatrix4(object.matrixWorld),
          );
          assert.ok(
            vertices.every((v) => v.toArray().every(Number.isFinite)),
            piece.component.id,
          );
          signedVolume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
          triangles++;
          for (let j = 0; j < 3; j++) {
            const a = pointKey(vertices[j]),
              b = pointKey(vertices[(j + 1) % 3]);
            if (a === b) {
              collapsedEdges++;
              continue;
            }
            const key = a < b ? a + '|' + b : b + '|' + a;
            const old = edges.get(key) ?? { count: 0, direction: 0 };
            edges.set(key, { count: old.count + 1, direction: old.direction + (a < b ? 1 : -1) });
          }
        }
      });
      const badEdges = [...edges.values()].filter((e) => e.count !== 2 || e.direction !== 0).length;
      const grounded = state !== 'print-layout' || Math.abs(bounds.min.z) < 0.03;
      const row = {
        id: piece.component.id,
        triangles,
        signedVolume,
        badEdges,
        collapsedEdges,
        grounded,
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
        passed:
          triangles > 0 && signedVolume > 0 && badEdges === 0 && collapsedEdges === 0 && grounded,
      };
      meshChecks.push(row);
    } catch (error) {
      meshChecks.push({ id: piece.component.id, passed: false, error: String(error) });
    } finally {
      if (model) disposeModel(model);
    }
  }
  records.push({ state, macroFile: filename, macroSHA256: sha(macro), components, meshChecks });
  writeFileSync(
    resolve(output, state + '-preview-checks.json'),
    JSON.stringify(meshChecks, null, 2) + '\n',
  );
}
const assembled = records.find((r) => r.state === 'assembled')!;
const printState = records.find((r) => r.state === 'print-layout')!;
for (const printed of printState?.components ?? []) {
  const physical = assembled.components.find((c) => c.id === printed.id);
  assert.ok(physical, printed.id + ': print has no installed physical occurrence');
  assert.equal(printed.libraryId, physical.libraryId);
  assert.equal(printed.presetId, physical.presetId);
  assert.deepEqual(
    printed.parameters,
    physical.parameters,
    printed.id + ': print geometry recipe changed',
  );
  assert.equal(printed.state, physical.state);
  assert.equal(printed.quantity, physical.quantity);
}

const ids = new Set(assembled.components.map((c) => c.id));
assert.ok(
  spec.sourceBindings?.occurrences && spec.sourceBindings?.files,
  'Regenerate the review specification with live source bindings.',
);
const currentBindings = assembled.components
  .map((c) => ({
    id: c.id,
    libraryId: c.libraryId,
    presetId: c.presetId,
    ...(c.libraryId !== 'manufactured-detail' ? { parameters: c.parameters } : {}),
    placement: c.placement,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));
assert.deepEqual(
  spec.sourceBindings.occurrences,
  JSON.parse(JSON.stringify(currentBindings)),
  'Specification poses/configurations are stale; regenerate before staging.',
);
for (const source of spec.sourceBindings.files)
  assert.equal(
    sha(readFileSync(resolve(source.path))),
    source.sha256,
    'Specification source changed: ' + source.path,
  );

assert.ok(
  Array.isArray(spec.motions) && spec.motions.length > 0,
  'Provide real assembly and tool paths.',
);
assert.equal(
  new Set(spec.motions.map((m: { id: string }) => m.id)).size,
  spec.motions.length,
  'Motion IDs must be unique.',
);
assert.ok(Array.isArray(spec.requiredCheckIds) && spec.requiredCheckIds.length > 0);
for (const check of spec.requiredCheckIds)
  assert.ok(
    spec.motions.some((m: { id: string }) => m.id === check),
    'Missing required check: ' + check,
  );
for (const motion of spec.motions) {
  assert.ok(motion.id && motion.kind);
  assert.ok(
    Array.isArray(motion.obstacleIds) && motion.obstacleIds.length > 0,
    motion.id + ': no obstacles',
  );
  for (const id of [...(motion.movingIds ?? []), ...motion.obstacleIds])
    assert.ok(ids.has(id), motion.id + ': missing occurrence ' + id);
  assert.ok(
    motion.movingIds?.length > 0 !== Boolean(motion.proxyCode),
    motion.id + ': use moving IDs OR native proxy',
  );
  assert.ok(motion.waypoints?.length >= 2, motion.id + ': path needs installed and exterior poses');
  assert.ok(motion.waypoints.every((v: number[]) => v.length === 3 && v.every(Number.isFinite)));
  assert.ok(
    motion.waypoints.some((v: number[]) => v.every((x) => Math.abs(x) < 1e-9)),
    motion.id + ': include the canonical installed/engagement pose',
  );
  assert.equal(
    motion.requireExteriorEndpoint,
    true,
    motion.id + ': full approach must start/end outside all stage obstacles',
  );
  assert.ok(
    motion.maxStep > 0 && motion.maxStep <= 1,
    motion.id + ': maximum translation step must be <=1 mm',
  );
  assert.ok(
    !(motion.movingIds ?? []).some((id: string) => motion.obstacleIds.includes(id)),
    motion.id + ': body is its own obstacle',
  );
  assert.ok(
    Array.isArray(motion.removedIds),
    motion.id + ': explicitly enumerate units not yet installed or removed for this stage',
  );
  if (motion.removedIds.length)
    assert.ok(
      typeof motion.stageReason === 'string' && motion.stageReason.length > 15,
      motion.id + ': explain the assembly stage',
    );
  const covered = [...(motion.movingIds ?? []), ...motion.obstacleIds, ...motion.removedIds];
  assert.equal(
    new Set(covered).size,
    covered.length,
    motion.id + ': stage groups must be disjoint',
  );
  assert.deepEqual(
    [...new Set(covered)].sort(),
    [...ids].sort(),
    motion.id + ': every physical occurrence must be present or explicitly removed',
  );
  for (const proxy of [...(motion.extraMoving ?? []), ...(motion.extraObstacles ?? [])])
    assert.ok(
      proxy.id && typeof proxy.shapeCode === 'string',
      motion.id + ': invalid carried cable proxy',
    );
}
const manifest = {
  schemaVersion: 1,
  previewChecksComplete: !nativeOnly,
  units: 'mm',
  partId: part.id,
  presetId: preset.id,
  parameters,
  stagedAt: new Date().toISOString(),
  stageScriptSHA256: sha(readFileSync(new URL(import.meta.url))),
  specification: spec,
  specificationSHA256: sha(readFileSync(resolve(specPath))),
  records,
  statement:
    'Immutable native macros and actual library geometry/printing poses; no historical geometry substituted.',
};
writeFileSync(resolve(output, 'review-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    output,
    states: records.map((r) => ({
      state: r.state,
      components: r.components.length,
      previewFailures: r.meshChecks.filter((x) => !x.passed),
    })),
  }),
);
assert.ok(
  records.every((r) => r.meshChecks.every((x) => x.passed)),
  'Preview topology or print grounding failed.',
);
