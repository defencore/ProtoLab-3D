import { parseConfiguration } from './configuration';
import type { AssemblyComponent } from './product-types';
import type { Parameters, PartDefinition } from './types';

const configurationFragment = '#configuration=';

export interface LinkedConfiguration {
  part: PartDefinition;
  parameters: Parameters;
  state: string;
  presetId: string;
}

/** A fragment preserves the selected occurrence without sending its parameters to the server. */
export function configurationLink(component: AssemblyComponent): string {
  return (
    configurationFragment +
    encodeURIComponent(
      JSON.stringify({
        version: 1,
        units: 'mm',
        part: component.libraryId,
        parameters: component.parameters,
        state: component.state,
        ...(component.presetId === undefined ? {} : { presetId: component.presetId }),
      }),
    )
  );
}

/** Explicit configuration links fail visibly; unrelated fragments leave normal startup intact. */
export function parseConfigurationLink(
  hash: string,
  parts: readonly PartDefinition[],
): LinkedConfiguration | undefined {
  if (hash !== '#configuration' && !hash.startsWith(configurationFragment)) return undefined;
  if (!hash.startsWith(configurationFragment))
    throw new Error('The configuration link is missing its parameters.');
  const text = decodeURIComponent(hash.slice(configurationFragment.length));
  const selection = parseConfiguration(text, parts);
  return { ...selection, presetId: selection.presetId ?? 'custom' };
}
