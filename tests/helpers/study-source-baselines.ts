import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import namingChanges from '../fixtures/mechanism-component-name-deltas.json';
import externalReferenceChanges from '../fixtures/mechanism-external-reference-deltas.json';
import selectableLeadChanges from '../fixtures/tr8-selectable-lead-source-deltas.json';

const executionIndexFiles = new Set(
  [
    'sfk-rotary-actuator',
    'sfk-disc-actuator',
    'sfk-slotted-actuator',
    'tr8-compact-actuator',
    'tr8-quad-actuator',
    'tr8-quad-mini-actuator',
    'tr8-quad-cnc-actuator',
    'tr8-quad-staggered-actuator',
    'tr8-quad-guided-actuator',
    'tr8-quad-guided-staggered-actuator',
    'tr8-quad-laser-guided-actuator',
    'tr8-quad-twin-pin-actuator',
    'tr8-quad-twin-pin-mini-actuator',
    'tr8-geared-rocker-actuator',
  ].map((id) => `${id}/index.ts`),
);
const executionStart = '// Execution catalog metadata.\n';
const executionEnd = '// End execution catalog metadata.\n';

/** Parse data without evaluating the source: no calls, spreads or computed properties. */
function executionLiteral(node: ts.Expression): unknown {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(executionLiteral);
  assert.ok(
    ts.isObjectLiteralExpression(node),
    'Execution metadata must contain only literal data.',
  );
  const value: Record<string, unknown> = Object.create(null);
  for (const property of node.properties) {
    assert.ok(ts.isPropertyAssignment(property), 'Execution metadata requires plain properties.');
    assert.ok(
      ts.isIdentifier(property.name) || ts.isStringLiteral(property.name),
      'Execution metadata cannot use computed properties.',
    );
    const key = property.name.text;
    assert.ok(!Object.hasOwn(value, key), 'Execution metadata cannot duplicate properties.');
    value[key] = executionLiteral(property.initializer);
  }
  return value;
}

/** Remove only reviewed, data-only navigation additions from the original module wrappers. */
function indexBeforeExecutionCatalog(file: string, content: Buffer): Buffer {
  const source = content.toString('utf8');
  const rocker = file === 'tr8-geared-rocker-actuator/index.ts';
  const hasMarker =
    source.includes('// Execution catalog metadata.') ||
    source.includes('// End execution catalog metadata.');
  if (!executionIndexFiles.has(file)) {
    assert.ok(!hasMarker, `${file}: execution metadata is outside the reviewed module wrappers.`);
    return content;
  }
  const start = source.indexOf(executionStart);
  const end = source.indexOf(executionEnd);
  assert.ok(
    start >= 0 && end > start,
    `${file}: execution metadata markers are missing or malformed.`,
  );
  assert.equal(
    source.indexOf(executionStart, start + 1),
    -1,
    'Duplicate execution metadata block.',
  );
  assert.equal(source.indexOf(executionEnd, end + 1), -1, 'Duplicate execution metadata block.');
  assert.ok(
    start === 0 || source[start - 1] === '\n',
    'Execution metadata must begin on its own line.',
  );
  assert.equal(source[end - 1], '\n', 'Execution metadata must end on its own line.');
  const block = source.slice(start + executionStart.length, end);
  const parsed = ts.createSourceFile(file, block, ts.ScriptTarget.Latest, true);
  assert.equal(
    (parsed as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics
      .length,
    0,
    'Execution metadata must parse without errors.',
  );
  const keys = rocker ? ['mechanismExecution'] : ['browseFamily', 'mechanismExecution'];
  assert.equal(
    parsed.statements.length,
    keys.length,
    'Execution metadata must contain only its reviewed assignments.',
  );
  const assignments = parsed.statements.map((statement, index) => {
    assert.ok(ts.isExpressionStatement(statement) && ts.isBinaryExpression(statement.expression));
    const expression = statement.expression;
    assert.equal(expression.operatorToken.kind, ts.SyntaxKind.EqualsToken);
    assert.ok(
      ts.isPropertyAccessExpression(expression.left) &&
        ts.isIdentifier(expression.left.expression) &&
        expression.left.expression.text === 'part' &&
        !expression.left.questionDotToken,
      'Execution metadata must assign to the existing part object.',
    );
    assert.equal(expression.left.name.text, keys[index]);
    const value = executionLiteral(expression.right);
    assert.ok(value && typeof value === 'object' && !Array.isArray(value));
    return value as Record<string, unknown>;
  });
  const [family, execution] = rocker ? [undefined, assignments[0]] : assignments;
  const primary = file === 'tr8-compact-actuator/index.ts';
  if (!rocker) {
    assert.ok(family);
    assert.deepEqual(
      Object.keys(family).sort(),
      primary ? ['id', 'label', 'primary'] : ['id', 'label'],
    );
    assert.equal(family.id, 'screw-rotary-actuators');
    assert.equal(family.label, 'Screw-driven rotary mechanisms');
    if (primary) assert.equal(family.primary, true);
  }
  assert.deepEqual(Object.keys(execution).sort(), [
    ...(execution.bearings === undefined ? [] : ['bearings']),
    'construction',
    'description',
    'materials',
    'motors',
    'outputs',
    'processes',
    'screws',
    'travelDegrees',
  ]);
  assert.equal(execution.outputs, file.startsWith('sfk-') || primary || rocker ? 1 : 4);
  for (const key of ['construction', 'description'])
    assert.ok(typeof execution[key] === 'string' && execution[key].trim());
  for (const key of ['materials', 'processes']) {
    const values = execution[key];
    assert.ok(Array.isArray(values) && values.length > 0);
    assert.ok(values.every((value) => typeof value === 'string' && value.trim()));
    assert.equal(new Set(values).size, values.length);
  }
  assert.ok(Array.isArray(execution.motors) && execution.motors.length > 0);
  for (const motor of execution.motors) {
    assert.ok(motor && typeof motor === 'object' && !Array.isArray(motor));
    assert.ok(Object.keys(motor).every((key) => ['model', 'when'].includes(key)));
    assert.ok(typeof motor.model === 'string' && motor.model.trim());
  }
  if (execution.bearings !== undefined) {
    assert.ok(
      Array.isArray(execution.bearings) && execution.bearings.length > 0,
      'Bearing metadata requires a nonempty array.',
    );
    for (const bearing of execution.bearings) {
      assert.ok(
        bearing && typeof bearing === 'object' && !Array.isArray(bearing),
        'Bearing metadata requires a plain object.',
      );
      assert.ok(
        Object.keys(bearing).every((key) => ['model', 'when'].includes(key)),
        'Bearing metadata can contain only model and parameter conditions.',
      );
      assert.ok(
        typeof bearing.model === 'string' && bearing.model.trim(),
        'Bearing metadata requires an exact nonempty model.',
      );
      if (bearing.when !== undefined) {
        assert.ok(
          bearing.when && typeof bearing.when === 'object' && !Array.isArray(bearing.when),
          'Bearing conditions require a parameter object.',
        );
        assert.ok(Object.keys(bearing.when).length > 0, 'Bearing conditions cannot be empty.');
        assert.ok(
          Object.values(bearing.when).every(
            (value) =>
              typeof value === 'string' ||
              typeof value === 'boolean' ||
              (typeof value === 'number' && Number.isFinite(value)),
          ),
          'Bearing conditions require primitive parameter values.',
        );
      }
    }
  }
  assert.ok(typeof execution.travelDegrees === 'number' && execution.travelDegrees > 0);
  const screws = execution.screws;
  assert.ok(Array.isArray(screws) && screws.length === 1);
  for (const screw of screws) {
    assert.ok(screw && typeof screw === 'object' && !Array.isArray(screw));
    assert.ok(
      Object.keys(screw).every((key) =>
        ['designation', 'kind', 'lead', 'pitch', 'starts', 'when'].includes(key),
      ),
    );
    assert.equal(
      screw.designation,
      file.startsWith('sfk-') ? 'SFK0825' : rocker ? 'TR8×4(P2)' : 'TR8×8(P2)',
    );
    assert.equal(screw.kind, file.startsWith('sfk-') ? 'ball-screw' : 'lead-screw');
    assert.equal(screw.lead, file.startsWith('sfk-') ? 2.5 : rocker ? 4 : 8);
    for (const key of ['pitch', 'starts'])
      if (screw[key] !== undefined) assert.ok(typeof screw[key] === 'number' && screw[key] > 0);
  }
  return Buffer.from(source.slice(0, start) + source.slice(end + executionEnd.length), 'utf8');
}

/** Reverse exact reviewed title literals and the relocation of the rocker catalog block. */
function sourceBeforeComponentNames(file: string, content: Buffer): Buffer {
  const changes = (namingChanges as Record<string, { before: string; after: string }[]>)[file];
  if (!changes) return content;
  let source = content.toString('utf8');
  for (const { before, after } of changes) {
    const start = source.indexOf(after);
    assert.ok(start >= 0, `${file}: reviewed component title delta is missing or changed`);
    assert.equal(
      source.indexOf(after, start + after.length),
      -1,
      `${file}: ambiguous component title delta`,
    );
    source = source.slice(0, start) + before + source.slice(start + after.length);
  }
  return Buffer.from(source, 'utf8');
}

/** Reverse the sourced lead-selector adaptation without accepting unrelated geometry changes. */
function sourceBeforeSelectableLead(file: string, content: Buffer): Buffer {
  const record = (
    selectableLeadChanges.files as Record<string, { changes: { before: string; after: string }[] }>
  )[file];
  if (!record) return content;
  let source = content.toString('utf8');
  for (const { before, after } of record.changes) {
    const start = source.indexOf(after);
    assert.ok(start >= 0, `${file}: reviewed selectable lead delta is missing or changed`);
    assert.equal(
      source.indexOf(after, start + after.length),
      -1,
      `${file}: ambiguous selectable lead delta`,
    );
    source = source.slice(0, start) + before + source.slice(start + after.length);
  }
  return Buffer.from(source, 'utf8');
}

// These exact deltas were reviewed against the pre-ESKD study sources. After
// reversing the documented selectable-lead adaptation, every other source byte
// retains the original historical hash.
const singleIdentityParts = new Set([
  'sfk-disc-actuator/part.ts',
  'sfk-rotary-actuator/part.ts',
  'sfk-slotted-actuator/part.ts',
  'tr8-compact-actuator/part.ts',
]);
const quadIdentityParts = new Set(['tr8-quad-actuator/part.ts', 'tr8-quad-mini-actuator/part.ts']);
const nativeIdentityFiles = new Set([
  'sfk-disc-actuator/lib/native.ts',
  'sfk-rotary-actuator/lib/native.ts',
  'sfk-slotted-actuator/lib/native.ts',
  'tr8-compact-actuator/lib/native.ts',
]);
const identityBlock = `      ESKDIdentityJSON: JSON.stringify(
        eskdIdentity(definition, item.parameters, item.state, item.presetId, {
          ...item,
          designation: item.procurement?.designation ?? '',
          revision: 'A',
        }),
      ),
`;

/** Restore the reviewed reference and handoff text only for historical checksums. */
function sourceBeforeExternalReferences(file: string, content: Buffer): Buffer {
  const changes = (externalReferenceChanges as Record<string, { before: string; after: string }[]>)[
    file
  ];
  const revisions =
    file.endsWith('/README.md') && file !== 'tr8-geared-rocker-actuator/README.md'
      ? [
          {
            before: 'The handoff contains the package, SDK, workbench, and reference assets.',
            after:
              'The handoff contains the package, SDK, and workbench, with external source links retained in package metadata.',
          },
        ]
      : changes;
  if (!revisions) return content;
  let source = content.toString('utf8');
  for (const { before, after } of revisions) {
    const start = source.indexOf(after);
    assert.ok(start >= 0, `${file}: reviewed reference delta is missing or changed`);
    assert.equal(
      source.indexOf(after, start + after.length),
      -1,
      `${file}: ambiguous reference delta`,
    );
    source = source.slice(0, start) + before + source.slice(start + after.length);
  }
  return Buffer.from(source, 'utf8');
}

/** Preserve historical hashes while reversing only exact reviewed source deltas. */
export function preservedStudySource(file: string, content: Buffer): Buffer {
  content = sourceBeforeExternalReferences(file, content);
  content = sourceBeforeSelectableLead(file, content);
  content = sourceBeforeComponentNames(file, content);
  content = indexBeforeExecutionCatalog(file, content);
  const cncPart = file === 'tr8-quad-cnc-actuator/part.ts';
  if (
    !singleIdentityParts.has(file) &&
    !quadIdentityParts.has(file) &&
    !nativeIdentityFiles.has(file) &&
    !cncPart
  )
    return content;
  let source = content.toString('utf8');
  const replace = (current: string, original: string) => {
    const start = source.indexOf(current);
    assert.ok(start >= 0, `${file}: reviewed ESKD source delta is missing or changed`);
    assert.equal(
      source.indexOf(current, start + current.length),
      -1,
      `${file}: ambiguous source delta`,
    );
    source = source.slice(0, start) + original + source.slice(start + current.length);
  };
  if (singleIdentityParts.has(file))
    replace('\n  identityParameters: (p) => ({ ...p, outputAngle: 0 }),\n', '\n');
  if (quadIdentityParts.has(file))
    replace(
      '\n  identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),\n',
      '\n',
    );
  if (nativeIdentityFiles.has(file)) {
    replace("import { eskdIdentity } from '../../../core/eskd';\n", '');
    replace(identityBlock, '');
  }
  if (file === 'tr8-compact-actuator/lib/native.ts') {
    replace(
      `const singleThreadLayout: ActuatorThreadLayout = {
  screwThreadStart: -13,
  screwThreadEnd: 13,
  screwAxisZ: 10,
  nutThreadLength: 15,
};`,
      `const singleThreadLayout: ActuatorThreadLayout = {
  screwThreadStart: -13, screwThreadEnd: 13, screwAxisZ: 10, nutThreadLength: 15,
};`,
    );
    replace(
      `  if (
    !Object.values(threadLayout).every(Number.isFinite) ||
    threadLayout.screwThreadEnd <= threadLayout.screwThreadStart ||
    threadLayout.nutThreadLength <= 0
  )`,
      `  if (!Object.values(threadLayout).every(Number.isFinite) ||
      threadLayout.screwThreadEnd <= threadLayout.screwThreadStart || threadLayout.nutThreadLength <= 0)`,
    );
    replace(
      `      const from = internal
        ? displacement - threadLayout.nutThreadLength / 2
        : threadLayout.screwThreadStart;
      const to = internal
        ? displacement + threadLayout.nutThreadLength / 2
        : threadLayout.screwThreadEnd;`,
      `      const from = internal ? displacement - threadLayout.nutThreadLength / 2 : threadLayout.screwThreadStart;
      const to = internal ? displacement + threadLayout.nutThreadLength / 2 : threadLayout.screwThreadEnd;`,
    );
  }
  if (cncPart) {
    replace(
      '\n    identityParameters: (p) => ({ ...p, angleA: 0, angleB: 0, angleC: 0, angleD: 0 }),\n',
      '\n',
    );
    replace(
      `    defaults: { ...defaults },
    parameters: parameters.map((field) => ({ ...field, ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}) })),
    presets, presetMatchKeys: ['motorModel'],`,
      "    defaults, parameters, presets, presetMatchKeys: ['motorModel'],",
    );
  }
  return Buffer.from(source, 'utf8');
}

/**
 * Hash historical occurrences and native source after projecting ESKD identity
 * and rounding Full-mode transverse preview samples to 10 decimal places.
 * Python AST positions preserve the executable native source byte for byte.
 */
export function tr8CncPreservationHashes(
  captures: readonly { source: string; pieces: string; portablePreview: boolean }[],
): { sourceSha256: string; piecesSha256: string }[] {
  assert.ok(captures.every(({ source }) => source.includes('ESKDIdentityJSON')));
  const result = spawnSync(
    'python3',
    [fileURLToPath(new URL('./native-identity-projection.py', import.meta.url))],
    {
      input: JSON.stringify(captures),
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stderr}`);
  const projected: unknown = JSON.parse(result.stdout);
  assert.ok(
    Array.isArray(projected) &&
      projected.length === captures.length &&
      projected.every(
        (item) =>
          /^[a-f0-9]{64}$/.test(item.sourceSha256) && /^[a-f0-9]{64}$/.test(item.piecesSha256),
      ),
  );
  return projected;
}
