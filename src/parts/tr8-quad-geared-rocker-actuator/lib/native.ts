import { Euler, Matrix4, Vector3 } from 'three';
import {
  componentMetadataPlacementPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { eskdIdentity } from '../../../core/eskd';
import { num } from '../../../core/geometry';
import { currentGeometryMode } from '../../../core/geometry-mode';
import { libraries } from './model';

function frame(rotation: Vec, translation: Vec): Matrix4 {
  return new Matrix4()
    .makeRotationFromEuler(new Euler(...(rotation.map((v) => v * Math.PI / 180) as Vec), 'ZYX'))
    .setPosition(...translation);
}

/** Recover the authored thread axis through every recipe and occurrence transform. */
function threadFeature(piece: ConfiguredPiece) {
  const internal = /^[abcd]-nut$/.test(piece.component.id);
  if (!internal && !/^[abcd]-screw$/.test(piece.component.id)) return undefined;
  const source = piece.component.parameters.recipe;
  if (typeof source !== 'string') throw new Error('A TR8 occurrence requires its physical recipe.');
  const item = piece.component;
  const world = frame([0, 0, piece.angle ?? 0], piece.position ?? [0, 0, piece.z ?? 0])
    .multiply(frame(item.placement.rotation, item.placement.translation));
  const candidates: { center: Vector3; axis: Vector3; length: number; phase?: number }[] = [];
  function visit(shape: Shape, transform: Matrix4, negative = false): void {
    if (shape.kind === 'transform') {
      visit(shape.child, transform.clone().multiply(frame(shape.rotation, shape.translation)), negative);
      return;
    }
    if (shape.kind === 'helical-worm' && shape.starts === 2 && Math.abs(shape.lead - 4) < 1e-8 && negative === internal) {
      candidates.push({ center: new Vector3().applyMatrix4(transform), axis: new Vector3(0, 0, 1).transformDirection(transform), length: shape.length, phase: shape.phase });
    }
    if (shape.kind === 'cylinder' && negative === internal && Math.abs(shape.radius - (internal ? 4.05 : 4)) < 1e-8 && shape.height > (internal ? 10 : 20)) {
      const direction = new Vector3(...({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[shape.axis] as Vec));
      candidates.push({ center: new Vector3(...shape.origin).addScaledVector(direction, shape.height / 2).applyMatrix4(transform), axis: direction.transformDirection(transform), length: shape.height });
    }
    if ('children' in shape) shape.children.forEach((child, index) => visit(child, transform, shape.kind === 'subtract' && index > 0 ? !negative : negative));
  }
  visit(JSON.parse(source) as Shape, world);
  const stock = candidates.sort((a, b) => b.length - a.length)[0];
  if (!stock) throw new Error('Cannot locate the TR8 thread in ' + item.id);
  // The source nut's through-tool overruns each end face by 0.2 mm; finished
  // end reliefs remove a further 0.4 mm per face from the active engagement.
  const length = internal ? Number((stock.length - 1.2).toFixed(9)) : stock.length;
  return {
    designation: 'Tr8x4(P2) RH · two starts · 30 degree trapezoidal thread',
    internal,
    nominalDiameter: 8,
    rootDiameter: 5.5,
    pitch: 2,
    starts: 2,
    lead: 4,
    includedAngle: 30,
    length,
    origin: stock.center.clone().addScaledVector(stock.axis, -length / 2).toArray(),
    axis: stock.axis.toArray(),
    representation: currentGeometryMode() === 'full' ? 'machined-helix' : 'nominal-cylinder',
    ...(stock.phase === undefined ? {} : { phase: stock.phase }),
  };
}

/** Preserve supplier subcomponents while keeping one identity for each physical occurrence. */
export function nativePython(pieces: readonly ConfiguredPiece[]): string {
  const lines = [
    'import json',
    componentMetadataPlacementPython(),
    '_quad_rocker_cache = globals().get("_quad_rocker_cache", {})',
    'components = []',
    'component_labels = []',
    'component_colors = []',
    'component_metadata = []',
    'def _quad_rocker_source(source):',
    '    if source not in _quad_rocker_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source,scope)',
    '        _quad_rocker_cache[source] = scope',
    '    return _quad_rocker_cache[source]',
  ];
  for (const piece of pieces) {
    const item = piece.component;
    const definition = libraries.find((part) => part.id === item.libraryId);
    if (!definition) throw new Error('Unknown quad mechanism component: ' + item.libraryId);
    const channel = /^([abcd])-/.exec(item.id)?.[1];
    const provenance = {
      LibraryId: item.libraryId,
      ConfigurationJSON: JSON.stringify(item.parameters),
      Supply: item.supply,
      AssemblyOccurrenceId: item.id,
      ...(channel ? { QuadChannel: channel, PrototypeOccurrenceId: item.id.slice(2) } : {}),
      ESKDIdentityJSON: JSON.stringify(eskdIdentity(definition, item.parameters, item.state, item.presetId, {
        ...item,
        designation: item.procurement?.designation ?? '',
        revision: 'A',
      })),
    };
    const color = [16, 8, 0].map((shift) => ((piece.color >> shift) & 255) / 255);
    const feature = threadFeature(piece);
    lines.push(
      `scope = _quad_rocker_source(${JSON.stringify(definition.python(item.parameters, item.state))})`,
      'unit = scope["shape"]',
      `preserve = ${piece.preserveLibraryAppearance ? 'True' : 'False'}`,
      'children = unit.childShapes() if preserve and unit.ShapeType == "Compound" else [unit]',
      'colors = scope.get("component_colors") if preserve else None',
      'labels = scope.get("component_labels") if preserve else None',
      'metadata = scope.get("component_metadata")',
      'for index, source in enumerate(children):',
      '    child = source.copy()',
    );
    item.placement.rotation.forEach((angle, index) => {
      if (Math.abs(angle) > 1e-10) lines.push(`    child.rotate(App.Vector(),App.Vector(${[0, 1, 2].map((axis) => axis === index ? 1 : 0).join(',')}),${num(angle)})`);
    });
    lines.push(
      `    child.translate(App.Vector(${item.placement.translation.map(num).join(',')}))`,
      `    child.rotate(App.Vector(),App.Vector(0,0,1),${num(piece.angle ?? 0)})`,
      `    child.translate(App.Vector(${(piece.position ?? [0, 0, piece.z ?? 0]).map(num).join(',')}))`,
      `    if child.isNull() or not child.isValid() or not child.isClosed() or child.Volume <= 0${piece.requireSingleSolid ? ' or len(child.Solids) != 1' : ''}:`,
      `        raise ValueError(${JSON.stringify('Invalid quad mechanism component: ' + piece.label)})`,
      '    components.append(child)',
      `    component_labels.append(${JSON.stringify(piece.label)} + (" / " + labels[index] if labels is not None and len(labels)==len(children) else ""))`,
      `    component_colors.append(colors[index] if colors is not None and len(colors)==len(children) else ${JSON.stringify(color)})`,
      '    local = metadata[index] if metadata is not None and len(metadata)==len(children) else {}',
      `    placed = _pl_placed_metadata(local,${JSON.stringify(item.placement.rotation)},${JSON.stringify(item.placement.translation)},${num(piece.angle ?? 0)},${JSON.stringify(piece.position ?? [0, 0, piece.z ?? 0])})`,
      `    component_metadata.append(dict(placed,**${JSON.stringify(provenance)}))`,
    );
    if (feature) lines.push(
      `    component_metadata[-1]["ThreadFeaturesJSON"] = ${JSON.stringify(JSON.stringify([feature]))}`,
      `    component_metadata[-1]["ThreadCallouts"] = ${JSON.stringify(feature.designation)}`,
    );
  }
  return [...lines, 'shape = Part.makeCompound(components)'].join('\n');
}
