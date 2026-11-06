import { restoreThreadMaterial } from './thread-visual';
import { MeshStandardMaterial } from 'three';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  MaterialLoader,
  Mesh,
  type Material,
  type Object3D,
  type TypedArray,
} from 'three';
import type { Parameters } from './types';

export interface ModelComponentMetadata {
  occurrenceId?: string;
  libraryId?: string;
  configuration?: Parameters;
}

/** Resolve the component owning a surface before flattening its assembly hierarchy. */
export function modelComponentMetadata(object: Object3D): ModelComponentMetadata {
  let current: Object3D | null = object;
  while (current) {
    const { occurrenceId, libraryId, configuration } = current.userData;
    current = current.parent;
    if (typeof occurrenceId !== 'string' && typeof libraryId !== 'string') continue;
    return {
      ...(typeof occurrenceId === 'string' ? { occurrenceId } : {}),
      ...(typeof libraryId === 'string' ? { libraryId } : {}),
      ...(configuration && typeof configuration === 'object'
        ? { configuration: { ...configuration } as Parameters }
        : {}),
    };
  }
  return {};
}

/** Binary geometry transport: no JSON vertex arrays or main-thread CSG. */
export interface PackedModel {
  geometries: {
    attributes: Record<string, { array: TypedArray; itemSize: number; normalized: boolean }>;
    index: Uint16Array | Uint32Array | null;
    groups: { start: number; count: number; materialIndex?: number }[];
  }[];
  materials: ReturnType<Material['toJSON']>[];
  meshes: ({
    name: string;
    matrix: number[];
    geometry: number;
    materials: number[];
  } & ModelComponentMetadata)[];
}
export function packModel(root: Group): { model: PackedModel; buffers: ArrayBuffer[] } {
  root.updateMatrixWorld(true);
  const model: PackedModel = { geometries: [], materials: [], meshes: [] };
  const geometries = new Map<BufferGeometry, number>(),
    materials = new Map<Material, number>();
  const buffers = new Set<ArrayBuffer>();
  root.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    let geometry = geometries.get(o.geometry);
    if (geometry === undefined) {
      geometry = model.geometries.length;
      geometries.set(o.geometry, geometry);
      const attributes: PackedModel['geometries'][number]['attributes'] = {};
      for (const [name, a] of Object.entries(o.geometry.attributes)) {
        if (!(a instanceof BufferAttribute))
          throw new Error('Interleaved preview attributes are unsupported');
        attributes[name] = { array: a.array, itemSize: a.itemSize, normalized: a.normalized };
        buffers.add(a.array.buffer as ArrayBuffer);
      }
      const index = o.geometry.index?.array as Uint16Array | Uint32Array | undefined;
      if (index) buffers.add(index.buffer as ArrayBuffer);
      model.geometries.push({ attributes, index: index ?? null, groups: o.geometry.groups });
    }
    const ids = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => {
      let id = materials.get(m);
      if (id === undefined) {
        id = model.materials.length;
        materials.set(m, id);
        model.materials.push(m.toJSON());
      }
      return id;
    });
    model.meshes.push({
      name: o.name,
      matrix: o.matrixWorld.toArray(),
      geometry,
      materials: ids,
      ...modelComponentMetadata(o),
    });
  });
  return { model, buffers: [...buffers] };
}
export function unpackModel(model: PackedModel): Group {
  const geometries = model.geometries.map((g) => {
    const geometry = new BufferGeometry();
    for (const [name, a] of Object.entries(g.attributes))
      geometry.setAttribute(name, new BufferAttribute(a.array, a.itemSize, a.normalized));
    if (g.index) geometry.setIndex(new BufferAttribute(g.index, 1));
    for (const group of g.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
    return geometry;
  });
  const loader = new MaterialLoader(),
    materials = model.materials.map((m) => {
      const material = loader.parse(m);
      if (material instanceof MeshStandardMaterial) restoreThreadMaterial(material);
      return material;
    });
  return new Group().add(
    ...model.meshes.map((m) => {
      const selected = m.materials.map((i) => materials[i]);
      const mesh = new Mesh(geometries[m.geometry], selected.length === 1 ? selected[0] : selected);
      mesh.name = m.name;
      mesh.matrix.fromArray(m.matrix);
      mesh.matrixAutoUpdate = false;
      if (m.occurrenceId !== undefined) mesh.userData.occurrenceId = m.occurrenceId;
      if (m.libraryId !== undefined) mesh.userData.libraryId = m.libraryId;
      if (m.configuration !== undefined) mesh.userData.configuration = { ...m.configuration };
      return mesh;
    }),
  );
}
