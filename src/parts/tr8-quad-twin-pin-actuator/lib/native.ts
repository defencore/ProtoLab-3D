import {bearingKit} from './bearings';
import type {Parameters} from '../../../core/types';
import {componentMetadataPlacementPython} from '../../../core/assembly/detail-instances';
import {actuatorNativeSource} from '../../tr8-compact-actuator/part';
import {cncChannels,libraries,nativeThreadLayout,nutTravel} from '../../tr8-quad-cnc-actuator/part';
import {channelPieces} from './channel';
import {framePieces} from './frame';
import {layout,twinPin} from './layout';

export const threadLayout={...nativeThreadLayout(layout),nutThreadLength:twinPin.nutLength};
export function nativeSource(p:Parameters,state:string):string {
  const lines=['import json',componentMetadataPlacementPython(),'_twin_cache = {}','components = []','component_labels = []','component_colors = []','component_metadata = []',
    'def _twin_source(source):','    if source not in _twin_cache:','        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)','        _twin_cache[source] = scope','    return _twin_cache[source]'];
  for(const channel of cncChannels(p,state,layout)) {
    const source=actuatorNativeSource(channelPieces(p,channel.angle),nutTravel(layout,channel.angle),threadLayout,libraries);
    lines.push(`scope = _twin_source(${JSON.stringify(source)})`,
      'for source,label,rgb,record in zip(scope["components"],scope["component_labels"],scope["component_colors"],scope["component_metadata"]):',
      '    child = source.copy()',`    child.rotate(App.Vector(),App.Vector(1,0,0),${channel.clock})`,
      `    child.translate(App.Vector(${channel.origin.join(',')}))`,
      '    components.append(child)',`    component_labels.append(${JSON.stringify(channel.id.toUpperCase()+' · ')}+label)`,
      '    component_colors.append(rgb)',
      `    metadata = _pl_placed_metadata(record,${JSON.stringify([channel.clock,0,0])},${JSON.stringify(channel.origin)},0,[0,0,0])`,
      '    metadata["PrototypeOccurrenceId"] = record["AssemblyOccurrenceId"]',`    metadata["QuadChannel"] = ${JSON.stringify(channel.id)}`,
      `    metadata["AssemblyOccurrenceId"] = ${JSON.stringify(channel.id+'-')}+record["AssemblyOccurrenceId"]`,
      '    component_metadata.append(metadata)');
  }
  lines.push(`scope = _twin_source(${JSON.stringify(actuatorNativeSource(framePieces(bearingKit(p)),0,threadLayout,libraries))})`,
    'components.extend([item.copy() for item in scope["components"]])','component_labels.extend(scope["component_labels"])',
    'component_colors.extend(scope["component_colors"])','component_metadata.extend([dict(item) for item in scope["component_metadata"]])',
    'shape = Part.makeCompound(components)');
  return lines.join('\n');
}
