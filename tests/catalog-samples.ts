import type { PartDefinition } from '../src/core/types';

/** Exercise every shape variant and the stock size boundaries without repeating coatings. */
export function geometrySamples(part: PartDefinition) {
  const samples = new Map(part.presets.filter((p) => !p.catalog).map((p) => [p.id, p]));
  const groups = new Map<string, typeof part.presets>();
  for (const preset of part.presets) {
    const signature = JSON.stringify(
      part.parameters
        .filter((field) => field.type !== 'number')
        .map((field) => preset.parameters[field.key]),
    );
    const group = groups.get(signature) ?? [];
    group.push(preset);
    groups.set(signature, group);
  }
  for (const group of groups.values()) {
    samples.set(group[0].id, group[0]);
    for (const field of part.parameters.filter((field) => field.type === 'number')) {
      const sorted = [...group].sort(
        (a, b) => Number(a.parameters[field.key]) - Number(b.parameters[field.key]),
      );
      for (const preset of [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted.at(-1)!])
        samples.set(preset.id, preset);
    }
  }
  return [{ id: 'default', parameters: part.defaults }, ...samples.values()];
}
