import type { Parameters } from '../../../core/types';
import { componentPython } from '../../../core/assembly/detail-instances';
import { millingLibraries, millingPieces } from './composition';

/** Keep fabrication and buying routes on the actual editable CAD leaves. */
export function millingPython(parameters: Parameters, state: string): string {
  const pieces = millingPieces(parameters, state);
  const handoff = pieces.map(({ component }) => ({
    ...(component.manufacturing
      ? { ManufacturingJSON: JSON.stringify(component.manufacturing) }
      : {}),
    ...(component.procurement ? { ProcurementJSON: JSON.stringify(component.procurement) } : {}),
  }));
  return (
    componentPython(millingLibraries, pieces) +
    `\n_pl_handoff = json.loads(${JSON.stringify(JSON.stringify(handoff))})\n` +
    'if len(_pl_handoff) != len(component_metadata):\n' +
    '    raise ValueError("CAD handoff does not match the physical component count.")\n' +
    'for _metadata, _handoff in zip(component_metadata, _pl_handoff):\n' +
    '    _metadata.update(_handoff)\n'
  );
}
