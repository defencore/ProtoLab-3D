import type { PartDefinition } from './types';

/** Hide controls belonging to components absent from a partial inspection state.
 * Without a state (catalog filters), keep the complete parameter vocabulary.
 */
export function withParameterStates(
  part: PartDefinition,
  inactive: Record<string, readonly string[]>,
): PartDefinition {
  return {
    ...part,
    parameters: part.parameters.map((field) => ({
      ...field,
      visibleWhen: (values, state) =>
        (!state || !inactive[state]?.includes(field.key)) &&
        (!field.visibleWhen || field.visibleWhen(values, state)),
    })),
  };
}
