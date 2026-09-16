/** Native-recipe change audit, including every construction family and display detail.
 * Equal recipes are review candidates, not automatic defects: catalog metadata,
 * validation limits and equal-envelope SKUs need not alter geometry.
 * PART_FILTER=id,id limits a follow-up. Reports are written outside the repository.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parts } from '../src/parts';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';
const filter = process.env.PART_FILTER?.split(',');
const report = [];
for (const part of parts.filter((p) => !filter || filter.includes(p.id))) {
  const row = {
    id: part.id,
    catalog: !!part.catalogSelectionOnly,
    tested: 0,
    unchanged: [] as unknown[],
    untested: [] as unknown[],
    errors: [] as unknown[],
  };
  const bases = new Map<string, Parameters>();
  const add = (p: Parameters) => bases.set(JSON.stringify(p), p);
  add(part.defaults);
  const families = new Set<string>();
  for (const preset of part.presets) {
    const key = JSON.stringify(
      Object.entries(preset.parameters).filter(([k]) =>
        ['form', 'layout', 'type', 'configuration'].includes(k),
      ),
    );
    if (!families.has(key)) {
      families.add(key);
      add({ ...part.defaults, ...preset.parameters });
    }
  }
  if (
    part.parameters.some(
      (f) => f.key === 'detail' && f.options?.some((o) => o.value === 'detailed'),
    )
  ) {
    for (const p of [...bases.values()]) add({ ...p, detail: 'detailed' });
  }
  const hash = (p: Parameters, s: string) =>
    createHash('sha256').update(part.python(p, s)).digest('hex');
  // Exploded inspection changes placements, but often builds meshes; geometry
  // validity there is covered by the native CAD verification suite instead.
  const states = part.states?.filter((s) => s.id !== 'exploded').map((s) => s.id) ?? ['default'];
  for (const p of bases.values())
    for (const state of states) {
      if (validateParameters(part, p, state).length) continue;
      let original: string;
      try {
        original = hash(p, state);
      } catch (e) {
        row.errors.push({ state, form: p.form, error: String(e) });
        continue;
      }
      for (const f of part.parameters) {
        if (f.visibleWhen && !f.visibleWhen(p, state)) continue;
        const v = p[f.key],
          context = { field: f.key, form: p.form, detail: p.detail, state };
        const values =
          f.type === 'select'
            ? f.options!.map((o) => o.value)
            : f.type === 'boolean'
              ? [!v]
              : [
                  Number(v) + (f.step ?? 1),
                  Number(v) * 1.2,
                  Number(v) - (f.step ?? 1),
                  Number(v) * 0.8,
                ];
        let tested = 0,
          changed = 0;
        for (const value of values) {
          if (value === v) continue;
          let candidate = { ...p, [f.key]: value };
          try {
            if (part.updateParameters) candidate = part.updateParameters(candidate, f.key);
            if (validateParameters(part, candidate, state).length) continue;
            tested++;
            row.tested++;
            if (hash(candidate, state) !== original) changed++;
            else if (f.type === 'select') row.unchanged.push({ ...context, from: v, to: value });
          } catch (e) {
            row.errors.push({ ...context, value, error: String(e) });
          }
          if (f.type === 'number' && changed) break;
        }
        if (!tested) row.untested.push(context);
        else if (!changed && f.type !== 'select') row.unchanged.push({ ...context, value: v });
      }
    }
  for (const key of ['unchanged', 'untested', 'errors'] as const)
    row[key] = [...new Map(row[key].map((item) => [JSON.stringify(item), item])).values()];
  report.push(row);
  process.stdout.write(JSON.stringify(row) + '\n');
}
writeFileSync(
  process.argv[2] ?? '/tmp/protolab-parameter-audit.json',
  JSON.stringify(report, null, 2),
);
if (report.some((row) => row.errors.length)) process.exitCode = 1;
