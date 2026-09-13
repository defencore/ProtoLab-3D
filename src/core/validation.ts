import type { Parameters, PartDefinition } from './types';

export function validateParameters(
  part: PartDefinition,
  values: Parameters,
  state: string,
): string[] {
  const errors: string[] = [];
  for (const field of part.parameters) {
    const visible = !field.visibleWhen || field.visibleWhen(values);
    const value = values[field.key];
    if (field.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value))
        errors.push(`${field.label} must be a finite number.`);
      else if (
        visible &&
        ((field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max))
      ) {
        errors.push(
          `${field.label} must be between ${field.min ?? '−∞'} and ${field.max ?? '∞'} ${field.unit ?? ''}.`,
        );
      }
    }
    if (field.type === 'select' && !field.options?.some((option) => option.value === value))
      errors.push(`Choose a valid ${field.label.toLowerCase()}.`);
    if (field.type === 'boolean' && typeof value !== 'boolean')
      errors.push(`${field.label} must be enabled or disabled.`);
  }
  if (errors.length) return errors;
  if (part.states && !part.states.some((option) => option.id === state))
    return ['Choose a valid model state.'];
  if (!part.states && state !== 'default') return ['This part only supports the default state.'];
  try {
    return part.validate(values, state);
  } catch {
    return ['These parameters could not be evaluated.'];
  }
}
