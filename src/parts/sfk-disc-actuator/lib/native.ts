import {
  componentMetadataPlacementPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import { num } from '../../../core/geometry';
import { libraries, nominalJournalNut } from './components';
import { withGeometryMode } from '../../../core/geometry-mode';
import { eskdIdentity } from '../../../core/eskd';

/** Retain each supplier's internal materials while preserving one procurement occurrence. */
export function actuatorPython(pieces: readonly ConfiguredPiece[]): string {
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
    const definition = libraries.find((p) => p.id === item.libraryId)!;
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
      `scope = _actuator_source(${JSON.stringify(
        nominalJournalNut(piece)
          ? withGeometryMode('simple', () => definition.python(item.parameters, item.state))
          : definition.python(item.parameters, item.state),
      )})`,
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
  }
  lines.push('shape = Part.makeCompound(components)');
  return lines.join('\n');
}
