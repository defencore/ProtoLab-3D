import { Group, Box3, Vector3 } from 'three';
import * as release from '../../rocket-release/lib/assembly';
import * as visual from './visual-assembly';
export interface Assembly {
  rigid: release.Piece[];
  flex: visual.Piece[];
}
export function geometry(p: Assembly) {
  return new Group().add(
    ...release.geometry(p.rigid).children.slice(),
    ...visual.geometry(p.flex).children.slice(),
  );
}
export function dimensions(p: Assembly): [number, number, number] {
  // Reuse the detailed library's cached component meshes; never dispose them here.
  const model = geometry(p);
  model.updateMatrixWorld(true);
  return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
    number,
    number,
    number,
  ];
}
export function python(p: Assembly): string {
  return [
    release.python(p.rigid),
    '_recovery_rigid=(components,component_labels,component_colors,component_metadata,component_manufactured,component_materials)',
    visual.python(p.flex),
    '_recovery_flex_count=len(components)',
    'components=_recovery_rigid[0]+components',
    'component_labels=_recovery_rigid[1]+component_labels',
    'component_colors=_recovery_rigid[2]+component_colors',
    'component_metadata=_recovery_rigid[3]+[{"Procurement":"BUY_ASSEMBLY_OR_COMPONENT","DrawingStatus":"Fabric routing envelope only; select a rated recovery system"} for _ in range(_recovery_flex_count)]',
    'component_manufactured=_recovery_rigid[4]+[False]*_recovery_flex_count',
    'component_materials=_recovery_rigid[5]+["Fabric"]*_recovery_flex_count',
    'shape=Part.makeCompound(components)',
  ].join('\n');
}
