import type { Parameters } from '../../../core/types';
import { componentMetadataPlacementPython } from '../../../core/assembly/detail-instances';
import { actuatorNativeSource } from '../../tr8-compact-actuator/part';
import { cncChannels, nativeThreadLayout, nutTravel, libraries } from '../../tr8-quad-cnc-actuator/part';
import { laserLayout } from './layout';
import { laserChannelPieces } from './channel';
import { framePieces } from './frame';
import { centralGuidePiece } from './guide';

export function laserPython(p:Parameters,state:string) {
  const lines=['import json',componentMetadataPlacementPython(),'_laser_cache = {}',
    'components = []','component_labels = []','component_colors = []','component_metadata = []',
    'def _laser_source(source):','    if source not in _laser_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}','        exec(source,scope)',
    '        _laser_cache[source] = scope','    return _laser_cache[source]'];
  for(const channel of cncChannels(p,state,laserLayout)) {
    const source=actuatorNativeSource(laserChannelPieces(p,channel.angle),nutTravel(laserLayout,channel.angle),nativeThreadLayout(laserLayout),libraries);
    lines.push(`scope = _laser_source(${JSON.stringify(source)})`,
      'for source, label, rgb, record in zip(scope["components"],scope["component_labels"],scope["component_colors"],scope["component_metadata"]):',
      '    child = source.copy()',`    child.rotate(App.Vector(),App.Vector(1,0,0),${channel.clock})`,
      `    child.translate(App.Vector(${channel.origin.join(',')}))`,
      '    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0: raise ValueError("Invalid laser-frame component")',
      '    components.append(child)',`    component_labels.append(${JSON.stringify(channel.id.toUpperCase()+' · ')}+label)`,
      '    component_colors.append(rgb)',
      `    metadata = _pl_placed_metadata(record,${JSON.stringify([channel.clock,0,0])},${JSON.stringify(channel.origin)},0,[0,0,0])`,
      '    metadata["PrototypeOccurrenceId"] = record["AssemblyOccurrenceId"]',
      `    metadata["QuadChannel"] = ${JSON.stringify(channel.id)}`,
      `    metadata["AssemblyOccurrenceId"] = ${JSON.stringify(channel.id+'-')}+record["AssemblyOccurrenceId"]`,
      '    component_metadata.append(metadata)');
  }
  const source=actuatorNativeSource([...framePieces(),centralGuidePiece()],0,nativeThreadLayout(laserLayout),libraries);
  lines.push(`scope = _laser_source(${JSON.stringify(source)})`,
    'components.extend([item.copy() for item in scope["components"]])',
    'component_labels.extend(scope["component_labels"])','component_colors.extend(scope["component_colors"])',
    'component_metadata.extend([dict(item) for item in scope["component_metadata"]])','shape = Part.makeCompound(components)');
  return lines.join('\n');
}
