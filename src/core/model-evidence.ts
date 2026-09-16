import type { Parameters, PartDefinition, Preset } from './types';
import { presetMatchesConfiguration } from './catalog-models';

/** Source provenance is separate from mesh validity and catalog identity. */
export function modelEvidence(part: PartDefinition, parameters: Parameters, presetId?: string) {
  const selected = part.presets.find(
    (p) => p.id === presetId && presetMatchesConfiguration(part, p, parameters),
  );
  const preset =
    selected ?? part.presets.find((p) => presetMatchesConfiguration(part, p, parameters));
  const catalog = preset?.catalog;
  const evidence = catalog?.geometryEvidence;
  const kind = evidence?.kind ?? (catalog ? 'source-dimensions' : 'parametric');
  const labels = {
    'manufacturer-cad': 'Manufacturer CAD',
    'source-dimensions': 'Source dimensions · reconstructed shape',
    envelope: 'Envelope model',
    parametric: 'Parametric design',
  };
  return {
    kind,
    label: labels[kind],
    presetId: preset?.id,
    source: evidence?.sourceUrl ?? catalog?.sourceUrl,
    sourceSha256: evidence?.sourceSha256,
    summary:
      evidence?.summary ??
      (catalog
        ? 'Only the listed dimensions or model identity are sourced. This does not verify every surface, internal component or connector.'
        : 'This configuration is not an audited copy of a specific manufactured product.'),
    limitations:
      evidence?.limitations ??
      part.notes ??
      'No complete geometry comparison with an original product is recorded.',
    verifiedParameters: catalog?.verifiedParameters ?? [],
  };
}

export function presetEvidence(part: PartDefinition, preset: Preset) {
  return modelEvidence({ ...part, presets: [preset] }, { ...part.defaults, ...preset.parameters });
}
