import {
  componentMetadataPlacementPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import { num } from '../../../core/geometry';
import { libraries } from './components';
import { driveThreadCallout, tr8ThreadForLead, type Tr8Lead } from './drive';
import { threadMetadata } from '../../../core/thread-callouts';
import type { PartDefinition } from '../../../core/types';
import { eskdIdentity } from '../../../core/eskd';

export interface ActuatorThreadLayout {
  threadLead?: Tr8Lead;
  screwThreadStart: number;
  screwThreadEnd: number;
  screwAxisZ: number;
  nutThreadLength: number;
}
const singleThreadLayout: ActuatorThreadLayout = {
  screwThreadStart: -13,
  screwThreadEnd: 13,
  screwAxisZ: 10,
  nutThreadLength: 15,
};
/** Retain supplier materials and annotate the configured physical working threads. */
export function actuatorPython(
  pieces: readonly ConfiguredPiece[],
  displacement = 0,
  threadLayout: ActuatorThreadLayout = singleThreadLayout,
  definitions: readonly PartDefinition[] = libraries,
): string {
  tr8ThreadForLead(threadLayout.threadLead);
  if (
    !Object.values(threadLayout).every(Number.isFinite) ||
    threadLayout.screwThreadEnd <= threadLayout.screwThreadStart ||
    threadLayout.nutThreadLength <= 0
  )
    throw new Error('Actuator working-thread stations must be finite and ordered.');
  const lines = [
    'import json',
    componentMetadataPlacementPython(),
    '_actuator_cache = {}',
    'components = []',
    'component_labels = []',
    'component_colors = []',
    'component_metadata = []',
    'def _actuator_source(source):',
    '    if source not in _actuator_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)',
    '        _actuator_cache[source] = scope',
    '    return _actuator_cache[source]',
  ];
  for (const piece of pieces) {
    const item = piece.component;
    const definition = definitions.find((p) => p.id === item.libraryId);
    if (!definition) throw new Error('Missing actuator library definition: ' + item.libraryId);
    const color = [16, 8, 0].map((shift) => ((piece.color >> shift) & 255) / 255);
    const provenance = {
      LibraryId: item.libraryId,
      ConfigurationJSON: JSON.stringify(item.parameters),
      Supply: item.supply,
      AssemblyOccurrenceId: item.id,
      ESKDIdentityJSON: JSON.stringify(
        eskdIdentity(definition, item.parameters, item.state, item.presetId, {
          ...item,
          designation: item.procurement?.designation ?? '',
          revision: 'A',
        }),
      ),
    };
    lines.push(
      `scope = _actuator_source(${JSON.stringify(definition.python(item.parameters, item.state))})`,
      'unit = scope["shape"]',
      `preserve = ${piece.preserveLibraryAppearance ? 'True' : 'False'}`,
      'children = unit.childShapes() if preserve and unit.ShapeType == "Compound" else [unit]',
      'colors = scope.get("component_colors") if preserve else None',
      'labels = scope.get("component_labels") if preserve else None',
      'metadata = scope.get("component_metadata")',
      'for index, source in enumerate(children):',
      '    child = source.copy()',
    );
    for (const [axis, angle] of item.placement.rotation.entries())
      if (Math.abs(angle) > 1e-10)
        lines.push(
          `    child.rotate(App.Vector(),App.Vector(${[0, 1, 2].map((i) => (i === axis ? 1 : 0)).join(',')}),${num(angle)})`,
        );
    lines.push(
      `    child.translate(App.Vector(${item.placement.translation.map(num).join(',')}))`,
      '    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0:',
      `        raise ValueError(${JSON.stringify('Invalid actuator component: ' + piece.label)})`,
      ...(item.supply === 'manufactured'
        ? [
            '    if len(child.Solids) != 1:',
            `        raise ValueError(${JSON.stringify('Disconnected manufactured detail: ' + piece.label)})`,
          ]
        : []),
      '    components.append(child)',
      `    component_labels.append(${JSON.stringify(piece.label)} + (" / " + labels[index] if labels is not None and len(labels)==len(children) else ""))`,
      `    component_colors.append(colors[index] if colors is not None and len(colors)==len(children) else ${JSON.stringify(color)})`,
      '    local = metadata[index] if metadata is not None and len(metadata)==len(children) else {}',
      `    placed = _pl_placed_metadata(local,${JSON.stringify(item.placement.rotation)},${JSON.stringify(item.placement.translation)},0,[0,0,0])`,
      `    component_metadata.append(dict(placed,**${JSON.stringify(provenance)}))`,
    );
    if (item.id === 'lead-screw' || item.id === 'lead-nut') {
      const internal = item.id === 'lead-nut';
      const from = internal
        ? displacement - threadLayout.nutThreadLength / 2
        : threadLayout.screwThreadStart;
      const to = internal
        ? displacement + threadLayout.nutThreadLength / 2
        : threadLayout.screwThreadEnd;
      lines.push(
        `    component_metadata[-1].update(${JSON.stringify(threadMetadata([driveThreadCallout(internal, from, to, threadLayout.screwAxisZ, threadLayout.threadLead)]))})`,
      );
    }
  }
  lines.push('shape = Part.makeCompound(components)');
  return lines.join('\n');
}
