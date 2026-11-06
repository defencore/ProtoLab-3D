import {
  componentMetadataPlacementPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import { eskdIdentity } from '../../../core/eskd';
import { num } from '../../../core/geometry';
import { currentGeometryMode } from '../../../core/geometry-mode';
import { libraries } from './model';
import { fixed } from './layout';

/** Purchased internals retain their appearance while sharing one procurement occurrence. */
export function nativePython(pieces: readonly ConfiguredPiece[], nutX: number): string {
  const lines = [
    'import json',
    componentMetadataPlacementPython(),
    '_rocker_cache = {}',
    'components = []',
    'component_labels = []',
    'component_colors = []',
    'component_metadata = []',
    'def _rocker_source(source):',
    '    if source not in _rocker_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)',
    '        _rocker_cache[source] = scope',
    '    return _rocker_cache[source]',
  ];
  for (const piece of pieces) {
    const item = piece.component,
      definition = libraries.find((p) => p.id === item.libraryId)!;
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
    const color = [16, 8, 0].map((s) => ((piece.color >> s) & 255) / 255);
    lines.push(
      `scope = _rocker_source(${JSON.stringify(definition.python(item.parameters, item.state))})`,
      'unit = scope["shape"]',
      `preserve = ${piece.preserveLibraryAppearance ? 'True' : 'False'}`,
      'children = unit.childShapes() if preserve and unit.ShapeType == "Compound" else [unit]',
      'colors = scope.get("component_colors") if preserve else None',
      'labels = scope.get("component_labels") if preserve else None',
      'metadata = scope.get("component_metadata")',
      'for index, source in enumerate(children):',
      '    child = source.copy()',
    );
    item.placement.rotation.forEach((a, i) => {
      if (Math.abs(a) > 1e-10)
        lines.push(
          `    child.rotate(App.Vector(),App.Vector(${[0, 1, 2].map((j) => (i === j ? 1 : 0)).join(',')}),${num(a)})`,
        );
    });
    lines.push(
      `    child.translate(App.Vector(${item.placement.translation.map(num).join(',')}))`,
      `    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0${piece.requireSingleSolid ? ' or len(child.Solids) != 1' : ''}:`,
      `        raise ValueError(${JSON.stringify('Invalid mechanism component: ' + piece.label)})`,
      '    components.append(child)',
      `    component_labels.append(${JSON.stringify(piece.label)} + (" / " + labels[index] if labels is not None and len(labels)==len(children) else ""))`,
      `    component_colors.append(colors[index] if colors is not None and len(colors)==len(children) else ${JSON.stringify(color)})`,
      '    local = metadata[index] if metadata is not None and len(metadata)==len(children) else {}',
      `    placed = _pl_placed_metadata(local,${JSON.stringify(item.placement.rotation)},${JSON.stringify(item.placement.translation)},0,[0,0,0])`,
      `    component_metadata.append(dict(placed,**${JSON.stringify(provenance)}))`,
    );
    if (item.id === 'screw' || item.id === 'nut') {
      const internal = item.id === 'nut',
        from = internal ? nutX - fixed.nutLength / 2 + fixed.nutEndReliefDepth : fixed.threadStart;
      const callout = {
        designation: 'Tr8x4(P2) RH · two starts · 30 degree trapezoidal thread',
        internal,
        nominalDiameter: 8,
        pitch: 2,
        starts: 2,
        lead: 4,
        includedAngle: 30,
        rootDiameter: 5.5,
        length: internal
          ? fixed.nutLength - 2 * fixed.nutEndReliefDepth
          : fixed.threadEnd - fixed.threadStart,
        origin: [from, 0, 0],
        axis: [1, 0, 0],
        representation: currentGeometryMode() === 'full' ? 'machined-helix' : 'nominal-cylinder',
      };
      lines.push(
        `    component_metadata[-1]["ThreadFeaturesJSON"] = ${JSON.stringify(JSON.stringify([callout]))}`,
        `    component_metadata[-1]["ThreadCallouts"] = ${JSON.stringify(callout.designation)}`,
      );
    }
  }
  return [...lines, 'shape = Part.makeCompound(components)'].join('\n');
}
