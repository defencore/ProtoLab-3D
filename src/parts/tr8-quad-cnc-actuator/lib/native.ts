import type { Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentMetadataPlacementPython } from '../../../core/assembly/detail-instances';
import { actuatorNativeSource } from '../../tr8-compact-actuator/part';
import { channelPieces, libraries } from './channel';
import { cncChannels } from './placement';
import { nativeThreadLayout, nutTravel, type CncLayout } from './layout';

export function cncPython(p: Parameters, state: string, layout: CncLayout, frame: readonly ConfiguredPiece[]): string {
  const lines = ['import json', componentMetadataPlacementPython(), '_cnc_cache = {}',
    'components = []', 'component_labels = []', 'component_colors = []', 'component_metadata = []',
    'def _cnc_source(source):', '    if source not in _cnc_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}', '        exec(source,scope)',
    '        _cnc_cache[source] = scope', '    return _cnc_cache[source]'];
  for (const channel of cncChannels(p, state, layout)) {
    const centre = channel.neutralNutX + nutTravel(layout, channel.angle);
    const source = actuatorNativeSource(channelPieces(p, channel.angle, layout, channel.unit), centre, nativeThreadLayout(layout), libraries);
    lines.push(`scope = _cnc_source(${JSON.stringify(source)})`,
      'for source, label, rgb, record in zip(scope["components"],scope["component_labels"],scope["component_colors"],scope["component_metadata"]):',
      '    child = source.copy()', `    child.rotate(App.Vector(),App.Vector(1,0,0),${channel.clock})`,
      `    child.translate(App.Vector(${channel.origin.join(',')}))`,
      '    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0: raise ValueError("Invalid CNC quad component")',
      '    components.append(child)', `    component_labels.append(${JSON.stringify(channel.id.toUpperCase() + ' · ')} + label)`,
      '    component_colors.append(rgb)',
      `    metadata = _pl_placed_metadata(record,${JSON.stringify([channel.clock, 0, 0])},${JSON.stringify(channel.origin)},0,[0,0,0])`,
      '    metadata["PrototypeOccurrenceId"] = record["AssemblyOccurrenceId"]',
      `    metadata["QuadChannel"] = ${JSON.stringify(channel.id)}`,
      `    metadata["NeutralNutX"] = ${JSON.stringify(channel.neutralNutX)}`,
      `    metadata["AssemblyOccurrenceId"] = ${JSON.stringify(channel.id + '-')} + record["AssemblyOccurrenceId"]`,
      '    component_metadata.append(metadata)');
  }
  lines.push(`scope = _cnc_source(${JSON.stringify(actuatorNativeSource(frame, 0, nativeThreadLayout(layout), libraries))})`,
    'components.extend([item.copy() for item in scope["components"]])',
    'component_labels.extend(scope["component_labels"])', 'component_colors.extend(scope["component_colors"])',
    'component_metadata.extend([dict(item) for item in scope["component_metadata"]])', 'shape = Part.makeCompound(components)');
  return lines.join('\n');
}
