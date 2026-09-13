import type { Parameters, PartDefinition } from './types';
import { validateParameters } from './validation';

export function parseConfiguration(
  text: string,
  parts: PartDefinition[],
): {
  part: PartDefinition;
  parameters: Parameters;
  state: string;
} {
  const config = JSON.parse(text);
  const part = parts.find((item) => item.id === config?.part);
  if (
    config?.version !== 1 ||
    config?.units !== 'mm' ||
    !part ||
    !config.parameters ||
    typeof config.parameters !== 'object' ||
    Array.isArray(config.parameters) ||
    typeof config.state !== 'string'
  ) {
    throw new Error('Choose a ProtoLab parameters JSON file.');
  }
  const issues = validateParameters(part, config.parameters, config.state);
  if (issues.length) throw new Error(issues[0]);
  const parameters = Object.fromEntries(
    part.parameters.map((field) => [field.key, config.parameters[field.key]]),
  );
  return { part, parameters, state: config.state };
}
