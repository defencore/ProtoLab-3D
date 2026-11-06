import assert from 'node:assert/strict';
import test from 'node:test';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import type { AssemblyComponent } from '../src/core/product-types';
import type { EskdIdentity } from '../src/core/eskd';

/** Inspect root metadata only; embedded supplier Python is deliberately kept opaque. */
function directMetadata(source: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  let inFunction = false;
  for (const line of source.split('\n')) {
    if (/^def /.test(line)) {
      inFunction = true;
      continue;
    }
    if (inFunction && line.trim() && !/^\s/.test(line)) inFunction = false;
    if (inFunction) continue;
    // Channel wrappers forward complete identity records; primitive source caches do not.
    const channel =
      /^scope = _(?:quad|cnc|laser|twin|mini|faulhaber|surpass)_source\(("(?:[^"\\]|\\.)*")\)/.exec(
        line,
      );
    if (channel) {
      records.push(...directMetadata(JSON.parse(channel[1])));
      continue;
    }
    const assignedJson = /\bcomponent_metadata\s*=\s*json\.loads\(("(?:[^"\\]|\\.)*")\)/.exec(line);
    if (assignedJson) {
      records.splice(0, records.length, ...JSON.parse(JSON.parse(assignedJson[1])));
      continue;
    }
    const assignedArray = /^\s*component_metadata\s*=\s*(\[.*\])\s*$/.exec(line);
    if (assignedArray) {
      records.splice(0, records.length, ...JSON.parse(assignedArray[1]));
      continue;
    }
    if (/^\s*component_metadata\.append\(dict\(/.test(line)) {
      const start = line.indexOf('**{');
      const end = line.lastIndexOf('))');
      if (start >= 0 && end > start) records.push(JSON.parse(line.slice(start + 2, end)));
    }
  }
  return records;
}

test('every manufactured mechanism exports explicit component identities and valid configured composition', (context) => {
  const mechanisms = parts.filter(
    (part) =>
      part.product.supply === 'manufactured' &&
      ['assembly', 'complex', 'kit'].includes(part.product.kind),
  );
  assert.ok(mechanisms.length >= 71, 'The audit must include the complete mechanism library.');
  const libraries = new Map(parts.map((part) => [part.id, part]));
  let components = 0,
    identities = 0;
  for (const part of mechanisms) {
    const state =
      part.states?.find((item) => item.id === 'assembled')?.id ?? part.states?.[0]?.id ?? 'default';
    assert.deepEqual(validateParameters(part, part.defaults, state), [], part.id);
    assert.equal(typeof part.composition, 'function', part.id);
    const composition = part.composition!(part.defaults);
    assert.ok(composition.components.length > 0, part.id);
    const check = (item: AssemblyComponent) => {
      components++;
      const definition = libraries.get(item.libraryId);
      assert.ok(definition, `${part.id}/${item.id}: ${item.libraryId}`);
      assert.deepEqual(
        validateParameters(definition, item.parameters, item.state),
        [],
        `${part.id}/${item.id}`,
      );
      assert.ok(Number.isFinite(item.quantity) && item.quantity > 0, `${part.id}/${item.id}`);
      assert.ok(item.name.trim(), `${part.id}/${item.id}`);
      item.children?.forEach(check);
    };
    composition.components.forEach(check);
    const metadata = directMetadata(part.python(part.defaults, state));
    assert.ok(metadata.length > 0, `${part.id}: no direct physical component records`);
    for (const record of metadata) {
      if (record.Supply === 'reference') continue;
      assert.equal(
        typeof record.ESKDIdentityJSON,
        'string',
        `${part.id}: component identity missing`,
      );
      const identity = JSON.parse(String(record.ESKDIdentityJSON)) as EskdIdentity;
      assert.ok(identity.name.trim(), `${part.id}: component name missing`);
      assert.ok(identity.configurationKey, `${part.id}: physical configuration key missing`);
      assert.equal(identity.supply, record.Supply, `${part.id}: supply mismatch`);
      assert.ok(libraries.has(String(record.LibraryId)), `${part.id}: unknown component library`);
      if (identity.supply === 'manufactured') {
        assert.ok(
          identity.designation && identity.execution && identity.revision,
          `${part.id}: manufactured execution missing`,
        );
        assert.ok(
          identity.label.includes(identity.designation),
          `${part.id}: designation absent from label`,
        );
      }
      identities++;
    }
  }
  assert.ok(components > mechanisms.length && identities > mechanisms.length);
  context.diagnostic(
    `${mechanisms.length} mechanisms, ${components} configured occurrences, ${identities} component identity records.`,
  );
});
