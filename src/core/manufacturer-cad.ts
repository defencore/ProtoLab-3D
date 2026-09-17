import { unzlibSync } from 'three/addons/libs/fflate.module.js';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';

/** Runtime geometry baked from selected supplier STEP solids; source archives stay external. */
export interface SupplierSolid {
  positions: string;
  indices: string;
  groups: number[][];
  brep: string;
  bounds: number[];
  volume: number;
  sourceSolid: number;
}
export interface SupplierAsset {
  sourceSha256: string;
  sourceFile: string;
  components: SupplierSolid[];
}
export interface SupplierPlacement {
  key: string;
  label: string;
  translation: number[];
  moving?: boolean;
}
const templates = new WeakMap<SupplierSolid, BufferGeometry>();
function bytes(value: string): ArrayBuffer {
  const binary = atob(value),
    result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return new Uint8Array(unzlibSync(result)).buffer;
}
export function supplierGeometry(
  assets: Record<string, SupplierAsset>,
  placements: SupplierPlacement[],
  travel = 0,
): Group {
  const group = new Group();
  for (const placement of placements) {
    const asset = assets[placement.key];
    if (!asset) throw new Error(`Missing supplier geometry: ${placement.key}`);
    for (const [i, solid] of asset.components.entries()) {
      let template = templates.get(solid);
      if (!template) {
        template = new BufferGeometry();
        template.setAttribute(
          'position',
          new BufferAttribute(new Float32Array(bytes(solid.positions)), 3),
        );
        template.setIndex(new BufferAttribute(new Uint32Array(bytes(solid.indices)), 1));
        for (const [start, count, material] of solid.groups)
          template.addGroup(start, count, material);
        template.computeVertexNormals();
        template.userData.nativeTopology = true;
        templates.set(solid, template);
      }
      const mesh = new Mesh(template.clone(), [
        new MeshStandardMaterial({ color: '#b7bec7', metalness: 0.65, roughness: 0.32 }),
        new MeshStandardMaterial({ color: '#30343a', metalness: 0.25, roughness: 0.42 }),
      ]);
      mesh.name = placement.label + (asset.components.length > 1 ? ` · ${i + 1}` : '');
      mesh.position.set(
        placement.translation[0],
        placement.translation[1],
        placement.translation[2] + (placement.moving ? travel : 0),
      );
      group.add(mesh);
    }
  }
  return group;
}
export function supplierDimensions(
  assets: Record<string, SupplierAsset>,
  placements: SupplierPlacement[],
  travel = 0,
): [number, number, number] {
  const bounds = new Box3();
  for (const placement of placements)
    for (const solid of assets[placement.key].components) {
      const offset = new Vector3(...(placement.translation as [number, number, number]));
      if (placement.moving) offset.z += travel;
      bounds.union(
        new Box3(
          new Vector3(...(solid.bounds.slice(0, 3) as [number, number, number])).add(offset),
          new Vector3(...(solid.bounds.slice(3) as [number, number, number])).add(offset),
        ),
      );
    }
  return bounds.getSize(new Vector3()).toArray();
}
export function supplierPython(
  assets: Record<string, SupplierAsset>,
  placements: SupplierPlacement[],
  travel = 0,
): string {
  const lines = ['import base64, zlib', 'components = []', 'component_labels = []'];
  for (const placement of placements) {
    const asset = assets[placement.key];
    lines.push(`# Supplier ${asset.sourceFile} SHA-256: ${asset.sourceSha256}`);
    for (const [i, solid] of asset.components.entries()) {
      const [x, y, z] = placement.translation;
      lines.push(
        'item = Part.Shape()',
        `item.importBrepFromString(zlib.decompress(base64.b64decode(${JSON.stringify(solid.brep)})).decode('utf-8'))`,
        `item.translate(App.Vector(${x}, ${y}, ${z + (placement.moving ? travel : 0)}))`,
        'components.append(item)',
        `component_labels.append(${JSON.stringify(placement.label + (asset.components.length > 1 ? ` · ${i + 1}` : ''))})`,
      );
    }
  }
  lines.push(
    'shape = Part.makeCompound(components) if len(components) > 1 else components[0]',
    'component_colors = [[0.72, 0.75, 0.78] for _ in components]',
  );
  return lines.join('\n');
}
