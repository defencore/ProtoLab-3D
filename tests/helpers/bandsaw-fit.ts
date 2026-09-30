import part from '../../src/parts/automatic-band-saw/part';
import type { Parameters } from '../../src/core/types';
export interface FitCase {
  name: string;
  state: string;
  parameters: Parameters;
}
export function fitAuditCases(): FitCase[] {
  return [
    { name: 'ready', state: 'assembled', parameters: part.defaults },
    { name: 'load-open', state: 'loading', parameters: part.defaults },
    ...part.presets.map((p) => ({
      name: `${p.id}-optical-scan`,
      state: 'scanning',
      parameters: p.parameters,
    })),
    ...[0, 50, 100].flatMap((strokePosition) =>
      [25, 75].map((carriagePosition) => ({
        name: `independent-${strokePosition}-${carriagePosition}`,
        state: 'stroke',
        parameters: { ...part.defaults, strokePosition, carriagePosition },
      })),
    ),
    ...Array.from({ length: 9 }, (_, i) => ({
      name: `head-feed-${i}`,
      state: 'stroke',
      parameters: { ...part.defaults, strokePosition: i * 12.5, carriagePosition: i * 12.5 },
    })),
    ...part.presets.flatMap((p) =>
      ['feeding', 'bottom'].map((state) => ({
        name: `${p.id}-${state}`,
        state,
        parameters: p.parameters,
      })),
    ),
    ...['round', 'square', 'rectangular', 'triangular', 'oval'].flatMap((profile) =>
      ['feeding', 'bottom'].map((state) => ({
        name: `small-${profile}-${state}`,
        state,
        parameters: { ...part.defaults, profile, width: 30, height: 30, wall: 1 },
      })),
    ),
    ...[30, 120].flatMap((width) =>
      Array.from({ length: 15 }, (_, i) => ({
        name: `shelf-${width}-${i}`,
        state: 'stroke',
        parameters: {
          ...part.defaults,
          width,
          strokePosition: 100,
          carriagePosition: 100,
          shelfPosition: (i * 100) / 14,
        },
      })),
    ),
  ];
}
/** Cache identical BReps and pair results, never skip a hardware group or a fastening pair. */
export function fitAuditCode(cases: FitCase[]): string {
  const expressions = new Map<string, number>();
  const sources = cases.map(({ name, state, parameters }) => {
    const keys: number[] = [];
    const source = part
      .python(parameters, state)
      .replace(/^component = \((.*)\)\.removeSplitter\(\)$/gm, (_, expression: string) => {
        if (!expressions.has(expression)) expressions.set(expression, expressions.size);
        const key = expressions.get(expression)!;
        keys.push(key);
        return `component = _cached(${key}, ${JSON.stringify(expression)})`;
      });
    return { name, source, keys };
  });
  return `import FreeCAD as App
import Part, json
_shapes = {}
_pairs = {}
def _cached(key, expression):
    if key not in _shapes:
        s = eval(expression).removeSplitter()
        assert not s.isNull() and s.isValid() and s.Volume > 0 and all(v.isClosed() for v in s.Solids), ('invalid shape', key)
        _shapes[key] = s
    return _shapes[key].copy()
failures = []
for case in json.loads(${JSON.stringify(JSON.stringify(sources))}):
    exec(case['source'])
    boxes = [s.BoundBox for s in components]
    order = sorted(range(len(components)), key=lambda i: boxes[i].XMin)
    clashes = []
    for position, i in enumerate(order):
        a = boxes[i]
        for j in order[position+1:]:
            b = boxes[j]
            if b.XMin >= a.XMax - .001: break
            if min(a.YMax,b.YMax)-max(a.YMin,b.YMin) < .001 or min(a.ZMax,b.ZMax)-max(a.ZMin,b.ZMin) < .001: continue
            groups = {component_groups[i][0], component_groups[j][0]}
            # The band intentionally traverses stock while cutting; no hardware pair is excluded.
            if groups == {'Blade', 'Workpiece'}: continue
            key = tuple(sorted([case['keys'][i],case['keys'][j]]))
            if key not in _pairs: _pairs[key] = components[i].common(components[j]).Volume
            if _pairs[key] > .05: clashes.append([component_labels[i],component_labels[j],round(_pairs[key],4)])
    result = {'case':case['name'], 'components':len(components), 'clashes':clashes}
    print(json.dumps(result),flush=True)
    if clashes: failures.append(result)
assert not failures, json.dumps(failures)
print('ALL_PAIRS_FIT_OK',flush=True)
`;
}
