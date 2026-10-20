import { componentGeometry, componentPython } from '../../../core/assembly/detail-instances';
import detail from '../../manufactured-detail/part';
import purchased from '../../purchased-component/part';
import { configuredFabric } from './composition';
const libraries=[detail,purchased];
import { Group, Box3, Vector3, Mesh, MeshStandardMaterial } from 'three';
import type { Shape, Vec } from './shapes';
import { num } from '../../../core/geometry';
export interface Piece {
  shape: Shape;
  label: string;
  color: number;
  z?: number;
  position?: Vec;
  angle?: number;
}
export function geometry(pieces: Piece[]): Group {
  return componentGeometry(libraries,configuredFabric(pieces));
}
export function python(pieces: Piece[]): string {
  return componentPython(libraries,configuredFabric(pieces));
}
export function dimensions(pieces: Piece[]): Vec {
  const model = geometry(pieces);
  model.updateMatrixWorld(true);
  const size = new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as Vec;
  model.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose();
      (object.material as MeshStandardMaterial).dispose();
    }
  });
  return size;
}
