import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentMetadataPlacementPython } from '../../../core/assembly/detail-instances';
import type { Parameters } from '../../../core/types';
import { actuatorNativeSource } from '../../tr8-compact-actuator/part';
import { mechanismPieces, libraries } from './mechanism';
import { channels } from './placement';
import { mechanismLayout, nativeThreadLayout } from './layout';
/** Cache complete local channels, then place their actual supplier/native solids rigidly. */
export function quadPython(p:Parameters,state:string,frame:readonly ConfiguredPiece[]):string {
  const lines=['import json',componentMetadataPlacementPython(),
    '_quad_cache = {}','components = []','component_labels = []','component_colors = []','component_metadata = []',
    'def _quad_source(source):',
    '    if source not in _quad_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)',
    '        _quad_cache[source] = scope',
    '    return _quad_cache[source]',
  ];
  for(const channel of channels(p,state)) {
    const travel=mechanismLayout.radius*Math.tan(channel.angle*Math.PI/180);
    const source=actuatorNativeSource(mechanismPieces({...p,outputAngle:channel.angle},channel.angle),travel,nativeThreadLayout,libraries);
    lines.push(`scope = _quad_source(${JSON.stringify(source)})`,
      'for source, label, rgb, record in zip(scope["components"],scope["component_labels"],scope["component_colors"],scope["component_metadata"]):',
      '    child = source.copy()',
      `    child.rotate(App.Vector(),App.Vector(1,0,0),${channel.clock})`,
      `    child.translate(App.Vector(${channel.origin.join(',')}))`,
      '    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0: raise ValueError("Invalid quad native component")',
      '    components.append(child)',
      `    component_labels.append(${JSON.stringify(channel.id.toUpperCase()+' · ')} + label)`,
      '    component_colors.append(rgb)',
      `    metadata = _pl_placed_metadata(record,${JSON.stringify([channel.clock,0,0])},${JSON.stringify(channel.origin)},0,[0,0,0])`,
      '    metadata["PrototypeOccurrenceId"] = record["AssemblyOccurrenceId"]',
      `    metadata["QuadChannel"] = ${JSON.stringify(channel.id)}`,
      `    metadata["AssemblyOccurrenceId"] = ${JSON.stringify(channel.id+'-')} + record["AssemblyOccurrenceId"]`,
      '    component_metadata.append(metadata)');
  }
  if(frame.length) lines.push(`scope = _quad_source(${JSON.stringify(actuatorNativeSource(frame,0,nativeThreadLayout,libraries))})`,
    'components.extend([item.copy() for item in scope["components"]])',
    'component_labels.extend(scope["component_labels"])','component_colors.extend(scope["component_colors"])',
    'component_metadata.extend([dict(item) for item in scope["component_metadata"]])');
  lines.push('shape = Part.makeCompound(components)');
  return lines.join('\n');
}
