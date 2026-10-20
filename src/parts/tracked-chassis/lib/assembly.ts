import { Box3, Euler, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import type { AssemblyComponent } from '../../../core/product-types';
import type { Shape, Vec } from '../../../core/assembly/boundary/shapes';
import { detailComponent } from '../../../core/component-recipes';
import { num } from '../../../core/geometry';
import { disposeModel } from '../../../core/mechanical';
import detail from '../../manufactured-detail/part';
import wire from '../../formed-wire/part';
import motor from '../../machine-drive-motor/part';
import bearing from '../../ball-bearing/part';

export interface Piece {
  shape?: Shape;
  wire?: { points: Vec[]; diameter: number };
  library?: {
    id: 'machine-drive-motor' | 'ball-bearing';
    parameters: Parameters;
    presetId: string;
    state: string;
  };
  label: string;
  color: number;
  position?: Vec;
  rotation?: Vec;
}

function libraryDefinition(id: string): PartDefinition {
  if (id === detail.id) return detail;
  if (id === wire.id) return wire;
  if (id === motor.id) return motor;
  if (id === bearing.id) return bearing;
  throw new Error('Unknown tracked-chassis library component: ' + id);
}

/** A local fabrication definition or one complete purchased unit, never visual OEM internals. */
export function pieceDefinition(piece: Piece, index: number): AssemblyComponent {
  const id = `component-${index + 1}`;
  if (piece.library) {
    const definition = libraryDefinition(piece.library.id);
    const catalog = definition.presets.find(
      (preset) => preset.id === piece.library!.presetId,
    )?.catalog;
    if (!catalog) throw new Error('Tracked chassis needs an explicit supplier model.');
    return {
      id,
      libraryId: definition.id,
      parameters: { ...piece.library.parameters },
      presetId: piece.library.presetId,
      state: piece.library.state,
      name: piece.label,
      quantity: 1,
      supply: 'purchased',
      placement: {
        translation: [...(piece.position ?? [0, 0, 0])],
        rotation: [...(piece.rotation ?? [0, 0, 0])],
      },
      procurement: {
        designation: catalog.designation,
        manufacturer: catalog.manufacturer ?? '',
        source: catalog.sourceUrl,
      },
    };
  }
  if (piece.wire) {
    const anchor = new Vector3(...piece.wire.points[0]);
    const points = piece.wire.points.map((point) => new Vector3(...point).sub(anchor).toArray());
    const rotation = piece.rotation ?? [0, 0, 0];
    const translation = anchor
      .applyEuler(new Euler(...(rotation.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX'))
      .add(new Vector3(...(piece.position ?? [0, 0, 0])))
      .toArray() as Vec;
    return {
      id,
      libraryId: wire.id,
      parameters: {
        ...wire.defaults,
        path: JSON.stringify(points),
        wireDiameter: piece.wire.diameter,
      },
      state: 'default',
      name: piece.label,
      quantity: 1,
      supply: 'manufactured',
      placement: { translation, rotation },
    };
  }
  if (!piece.shape) throw new Error('A physical tracked-chassis component needs a definition.');
  const shape: Shape = {
    kind: 'transform',
    child: piece.shape,
    translation: piece.position ?? [0, 0, 0],
    rotation: piece.rotation ?? [0, 0, 0],
  };
  return detailComponent(id, piece.label, shape);
}

export function geometry(pieces: Piece[]): Group {
  return new Group().add(
    ...pieces.map((piece, index) => {
      const configured = pieceDefinition(piece, index);
      const group = libraryDefinition(configured.libraryId).buildGeometry(
        configured.parameters,
        configured.state,
      );
      group.name = piece.label;
      group.position.set(...configured.placement.translation);
      group.rotation.set(
        ...(configured.placement.rotation.map((angle) => (angle * Math.PI) / 180) as Vec),
        'ZYX',
      );
      group.userData.libraryId = configured.libraryId;
      group.userData.configuration = configured.parameters;
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.name = piece.label;
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            if (material instanceof MeshStandardMaterial) material.color.setHex(piece.color);
        }
      });
      return group;
    }),
  );
}

export function python(pieces: Piece[]): string {
  const configured = pieces.map(pieceDefinition);
  const lines = [
    '_pl_component_cache = {}',
    'def _pl_component(source):',
    '    if source not in _pl_component_cache:',
    '        scope = {"App":App,"Part":Part,"math":math}',
    '        exec(source, scope)',
    '        _pl_component_cache[source] = scope["shape"]',
    '    return _pl_component_cache[source].copy()',
    'components = []',
  ];
  for (const item of configured) {
    lines.push(
      `component = _pl_component(${JSON.stringify(libraryDefinition(item.libraryId).python(item.parameters, item.state))})`,
    );
    for (const [axis, angle] of item.placement.rotation.entries())
      if (angle)
        lines.push(
          `component.rotate(App.Vector(0,0,0),App.Vector(${[0, 1, 2].map((value) => (value === axis ? 1 : 0)).join(',')}),${num(angle)})`,
        );
    lines.push(
      `component.translate(App.Vector(${item.placement.translation.map(num).join(',')}))`,
      'components.append(component)',
    );
  }
  lines.push(
    'shape = Part.makeCompound(components)',
    `component_labels = ${JSON.stringify(pieces.map((piece) => piece.label))}`,
    `component_colors = ${JSON.stringify(pieces.map((piece) => [((piece.color >> 16) & 255) / 255, ((piece.color >> 8) & 255) / 255, (piece.color & 255) / 255]))}`,
    `component_metadata = ${JSON.stringify(configured.map((item) => ({ LibraryId: item.libraryId, PhysicalOccurrenceId: item.id, ConfigurationJSON: JSON.stringify(item.parameters), Supply: item.supply, Procurement: JSON.stringify(item.procurement ?? {}), DrawingStatus: item.supply === 'manufactured' ? 'Material, blank, operations, free shape and inspection remain project requirements.' : 'Verify the selected alternate component and delivered mounting interfaces; not a verified Hiwonder BOM.' })))}`,
  );
  return lines.join('\n');
}

export function dimensions(pieces: Piece[]): Vec {
  const model = geometry(pieces);
  model.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  } finally {
    disposeModel(model);
  }
}
