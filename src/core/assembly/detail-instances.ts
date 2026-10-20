import { Box3, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { detailComponent } from '../component-recipes';
import { disposeModel } from '../mechanical';
import { num } from '../geometry';
import type { PartDefinition } from '../types';
import type { AssemblyComponent } from '../product-types';
import type { Shape } from './boundary/shapes';

export interface DetailPiece {
  shape: Shape;
  label: string;
  color: number;
  z?: number;
  angle?: number;
}

/** Keep a family's explicit circular preview resolution when moving into library instances. */
export function withRadialSegments(shape: Shape, segments: number): Shape {
  if (!Number.isInteger(segments) || segments < 3 || segments > 2048)
    throw new Error('Radial resolution must be an integer from 3 to 2048.');
  switch (shape.kind) {
    case 'cylinder':
    case 'revolve':
      return { ...shape, segments };
    case 'transform':
      return { ...shape, child: withRadialSegments(shape.child, segments) };
    case 'union':
    case 'subtract':
      return {
        ...shape,
        children: shape.children.map((child) => withRadialSegments(child, segments)),
      };
    default:
      return shape;
  }
}

function definition(part: PartDefinition, piece: DetailPiece, index: number) {
  if (part.id !== 'manufactured-detail' || part.product.supply !== 'manufactured')
    throw new Error(
      'Custom component instances require the manufactured-detail library definition.',
    );
  return detailComponent(`component-${index + 1}`, piece.label, piece.shape);
}

/** Render actual library configurations; inspection offsets never modify their local recipes. */
export function detailGeometry(part: PartDefinition, pieces: readonly DetailPiece[]): Group {
  return componentGeometry(
    [part],
    pieces.map((piece, index) => ({ ...piece, component: definition(part, piece, index) })),
  );
}
/** Native CAD uses the same library configuration and placement as the preview. */
export function detailPython(part: PartDefinition, pieces: readonly DetailPiece[]): string {
  return componentPython(
    [part],
    pieces.map((piece, index) => ({ ...piece, component: definition(part, piece, index) })),
  );
}

export function detailDimensions(
  part: PartDefinition,
  pieces: readonly DetailPiece[],
): [number, number, number] {
  const model = detailGeometry(part, pieces);
  model.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}

export interface ConfiguredPiece {
  component: AssemblyComponent;
  /** Preserve source-native guarantees for a declared atomic fabricated component. */
  requireSingleSolid?: boolean;
  /** Supplier-native component colors and names identify installed product internals. */
  preserveLibraryAppearance?: boolean;
  label: string;
  color: number;
  position?: [number, number, number];
  z?: number;
  angle?: number;
}
function configuredPart(
  libraries: readonly PartDefinition[],
  piece: ConfiguredPiece,
): PartDefinition {
  const part = libraries.find((candidate) => candidate.id === piece.component.libraryId);
  if (!part) throw new Error('Missing concrete library definition: ' + piece.component.libraryId);
  const errors = part.validate(piece.component.parameters, piece.component.state);
  if (errors.length) throw new Error(errors.join(' '));
  return part;
}
/** Instantiate a declared library occurrence, retaining current inspection pose outside its definition. */
export function componentGeometry(
  libraries: readonly PartDefinition[],
  pieces: readonly ConfiguredPiece[],
  nominal = false,
): Group {
  const instances = pieces.map((piece) => {
    const configured = piece.component,
      part = configuredPart(libraries, piece),
      model = (nominal && part.buildExportGeometry ? part.buildExportGeometry : part.buildGeometry)(
        configured.parameters,
        configured.state,
      );
    const placed = new Group().add(model);
    placed.rotation.set(
      ...(configured.placement.rotation.map((angle) => (angle * Math.PI) / 180) as [
        number,
        number,
        number,
      ]),
      'ZYX',
    );
    placed.position.set(...configured.placement.translation);
    model.traverse((object) => {
      if (object instanceof Mesh) {
        object.name = piece.preserveLibraryAppearance
          ? `${piece.label} / ${object.name || 'library component'}`
          : piece.label;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (material instanceof MeshStandardMaterial && !piece.preserveLibraryAppearance)
            material.color.setHex(piece.color);
      }
    });
    const instance = new Group().add(placed);
    instance.name = piece.label;
    instance.rotation.z = ((piece.angle ?? 0) * Math.PI) / 180;
    instance.position.set(...(piece.position ?? [0, 0, piece.z ?? 0]));
    instance.userData.libraryId = configured.libraryId;
    instance.userData.configuration = configured.parameters;
    return instance;
  });
  const group = new Group();
  for (const instance of instances) group.add(instance);
  return group;
}
/** Place drawing feature frames by exactly the same rotation/translation as their geometry. */
export function componentMetadataPlacementPython(): string {
  return [
    'def _pl_placed_metadata(metadata, rotation, translation, angle, offset):',
    '    result = dict(metadata)',
    '    x,y,z = rotation',
    '    inner = App.Rotation(App.Vector(0,0,1),z).multiply(App.Rotation(App.Vector(0,1,0),y)).multiply(App.Rotation(App.Vector(1,0,0),x))',
    '    outer = App.Rotation(App.Vector(0,0,1),angle)',
    '    if result.get("ThreadFeaturesJSON"):',
    '        features = json.loads(result["ThreadFeaturesJSON"])',
    '        for feature in features:',
    '            if feature.get("origin") is not None:',
    '                point = outer.multVec(inner.multVec(App.Vector(*feature["origin"]))+App.Vector(*translation))+App.Vector(*offset)',
    '                feature["origin"] = [point.x,point.y,point.z]',
    '            if feature.get("axis") is not None:',
    '                axis = outer.multVec(inner.multVec(App.Vector(*feature["axis"])))',
    '                feature["axis"] = [axis.x,axis.y,axis.z]',
    '        result["ThreadFeaturesJSON"] = json.dumps(features)',
    '    if result.get("LibraryComponentMetadataJSON"):',
    '        records = json.loads(result["LibraryComponentMetadataJSON"])',
    '        for record in records:',
    '            record["metadata"] = _pl_placed_metadata(record["metadata"],rotation,translation,angle,offset)',
    '        result["LibraryComponentMetadataJSON"] = json.dumps(records)',
    '    return result',
  ].join('\n');
}
export function componentPython(
  libraries: readonly PartDefinition[],
  pieces: readonly ConfiguredPiece[],
): string {
  const lines = [
    'import json',
    '_pl_component_cache = {}',
    'def _pl_component(source):',
    '    if source not in _pl_component_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source, scope)',
    '        _pl_component_cache[source] = (scope["shape"], scope.get("component_metadata"), scope.get("component_labels"))',
    '    shape, metadata, labels = _pl_component_cache[source]',
    '    if not metadata:',
    '        return shape.copy(), {}',
    '    if len(metadata) == 1:',
    '        return shape.copy(), dict(metadata[0])',
    '    children = shape.childShapes() if shape.ShapeType == "Compound" else [shape]',
    '    if len(metadata) != len(children) or (labels is not None and len(labels) != len(children)):',
    '        raise ValueError("Nested library component records do not match its geometry.")',
    '    records = [{"index":index+1, "label":labels[index] if labels is not None else "Component %02d" % (index+1), "metadata":record} for index,record in enumerate(metadata)]',
    '    result = {"LibraryComponentMetadataJSON":json.dumps(records)}',
    '    features = []',
    '    for record in records:',
    '        for feature in json.loads(record["metadata"].get("ThreadFeaturesJSON", "[]")):',
    '            features.append(dict(feature, componentIndex=record["index"], componentLabel=record["label"]))',
    '    if features:',
    '        groups = {}',
    '        names = []',
    '        for feature in features:',
    '            name = ("internal " if feature["internal"] else "external ") + feature["designation"]',
    '            if name not in names: names.append(name)',
    '            key = name + "; nominal span %g mm" % feature["length"]',
    '            groups[key] = groups.get(key, 0)+1',
    '        result["ThreadFeaturesJSON"] = json.dumps(features)',
    '        result["ThreadLabels"] = "; ".join(names)',
    '        result["ThreadCallouts"] = "; ".join("%d× %s" % (count,key) for key,count in groups.items())',
    '        result["ThreadModel"] = "; ".join(dict.fromkeys(record["metadata"]["ThreadModel"] for record in records if record["metadata"].get("ThreadModel")))',
    '    return shape.copy(), result',
    ...componentMetadataPlacementPython().split('\n'),
    'components = []',
    'component_metadata = []',
  ];
  for (const piece of pieces) {
    const item = piece.component,
      part = configuredPart(libraries, piece);
    lines.push(
      `component, local_metadata = _pl_component(${JSON.stringify(part.python(item.parameters, item.state))})`,
    );
    for (const [index, angle] of item.placement.rotation.entries())
      if (angle)
        lines.push(
          `component.rotate(App.Vector(0,0,0),App.Vector(${[0, 1, 2].map((axis) => (axis === index ? 1 : 0)).join(',')}),${num(angle)})`,
        );
    if (item.supply === 'manufactured')
      lines.push(
        `if component.isNull() or not component.isValid() or not component.isClosed() or component.Volume <= 0${piece.requireSingleSolid ? ' or len(component.Solids) != 1' : ''}:`,
        `    raise ValueError(${JSON.stringify('Invalid manufactured library detail: ' + piece.label + (piece.requireSingleSolid ? ' (invalid or disconnected component)' : ''))})`,
      );
    lines.push(
      `component.translate(App.Vector(${item.placement.translation.map(num).join(',')}))`,
      `component.rotate(App.Vector(0,0,0),App.Vector(0,0,1),${num(piece.angle ?? 0)})`,
      `component.translate(App.Vector(${(piece.position ?? [0, 0, piece.z ?? 0]).map(num).join(',')}))`,
      `local_metadata = _pl_placed_metadata(local_metadata, ${JSON.stringify(item.placement.rotation)}, ${JSON.stringify(item.placement.translation)}, ${num(piece.angle ?? 0)}, ${JSON.stringify(piece.position ?? [0, 0, piece.z ?? 0])})`,
      'components.append(component)',
      `component_metadata.append(dict(local_metadata, **${JSON.stringify({ LibraryId: item.libraryId, ConfigurationJSON: JSON.stringify(item.parameters), Supply: item.supply })}))`,
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((piece) => piece.label))}`,
    `component_colors = ${JSON.stringify(pieces.map((piece) => [((piece.color >> 16) & 255) / 255, ((piece.color >> 8) & 255) / 255, (piece.color & 255) / 255]))}`,
  );
  return lines.join('\n');
}
export function componentDimensions(
  libraries: readonly PartDefinition[],
  pieces: readonly ConfiguredPiece[],
): [number, number, number] {
  const model = componentGeometry(libraries, pieces);
  model.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}
