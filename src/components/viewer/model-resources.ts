import { LineSegments, Mesh, type BufferGeometry, type Material, type Object3D } from 'three';

export interface MaterialAppearance {
  material: Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  side: Material['side'];
  wireframe?: boolean;
}

/** Shared model resources belong to the model, rather than to each of its mesh occurrences. */
export function disposeObject(object: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  object.traverse((child) => {
    if (child instanceof Mesh || child instanceof LineSegments) {
      geometries.add(child.geometry);
      const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
      childMaterials.forEach((material) => materials.add(material));
    }
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

/** Remove viewer additions before a cached model is reused or released. */
export function releaseModelPresentation(presentation: {
  edges: LineSegments[];
  appearances: MaterialAppearance[];
  componentMeshes: { mesh: Mesh; visible: boolean }[];
}) {
  const edges = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  for (const edge of presentation.edges) {
    edge.removeFromParent();
    edges.add(edge.geometry);
    (Array.isArray(edge.material) ? edge.material : [edge.material]).forEach((material) =>
      materials.add(material),
    );
  }
  edges.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  for (const { material, ...appearance } of presentation.appearances) {
    const { wireframe, ...properties } = appearance;
    Object.assign(material, properties);
    if ('wireframe' in material && wireframe !== undefined) material.wireframe = wireframe;
    material.needsUpdate = true;
  }
  for (const { mesh, visible } of presentation.componentMeshes) mesh.visible = visible;
  presentation.edges.length = 0;
  presentation.appearances.length = 0;
  presentation.componentMeshes.length = 0;
}
