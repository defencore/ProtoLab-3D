import { Euler, Matrix4, Vector3 } from 'three';
import type { Shape, Vec } from './assembly/boundary/shapes';
import type { AssemblyComponent, AssemblyDefinition } from './product-types';
import { detailComponent } from './component-recipes';
import { supplierComponent, supplierUnit, type SupplierUnit } from './supplier-components';

export type RecoveryFeature =
  | Exclude<Shape, { kind: 'transform' | 'union' | 'subtract' | 'intersect' }>
  | { kind: 'transform'; child: RecoveryFeature; translation: Vec; rotation: Vec }
  | { kind: 'union' | 'subtract' | 'intersect'; children: RecoveryFeature[] }
  | { kind: 'transform'; child: RecoveryFeature; angle: number; offset: Vec }
  | { kind: 'rotate'; child: RecoveryFeature; angle: number; axis: 'x' | 'y' }
  | { kind: 'spring'; radius: number; wire: number; height: number; turns: number };
export interface RecoveryPiece {
  shape: RecoveryFeature;
  label: string;
  color: number;
  position?: Vec;
  z?: number;
  angle?: number;
}
export interface ConfiguredRecoveryPiece extends RecoveryPiece {
  component: AssemblyComponent;
  feature?: Shape;
  supplier?: SupplierUnit;
}
/** Translate authored features, including complete planar contours; no mesh reconstruction. */
export function recoveryFeature(shape: RecoveryFeature, segments: number): Shape {
  switch (shape.kind) {
    case 'spring':
      throw new Error('A helical wire requires the formed-wire library definition.');
    case 'rotate':
      return {
        kind: 'transform',
        child: recoveryFeature(shape.child, segments),
        translation: [0, 0, 0],
        rotation: shape.axis === 'x' ? [shape.angle, 0, 0] : [0, shape.angle, 0],
      };
    case 'transform':
      return 'angle' in shape
        ? {
            kind: 'transform',
            child: recoveryFeature(shape.child, segments),
            translation: shape.offset,
            rotation: [0, 0, shape.angle],
          }
        : { ...shape, child: recoveryFeature(shape.child, segments) };
    case 'cylinder':
      return { ...shape, segments: shape.segments ?? segments };
    case 'revolve':
      return { ...shape, segments: shape.segments ?? 64 };
    case 'sphere':
      return { ...shape, segments: shape.segments ?? 48 };
    case 'union':
    case 'subtract':
    case 'intersect':
      return {
        ...shape,
        children: shape.children.map((child) => recoveryFeature(child, segments)),
      };
    default:
      return shape;
  }
}
function recoverySupplier(shape: RecoveryFeature): SupplierUnit | undefined {
  return supplierUnit(shape) ?? ('child' in shape ? recoverySupplier(shape.child) : undefined);
}
export function configureRecoveryPieces(
  pieces: readonly RecoveryPiece[],
  segments: number,
  spring?: (piece: RecoveryPiece, index: number) => AssemblyComponent,
): ConfiguredRecoveryPiece[] {
  return pieces.map((piece, index) => {
    if (piece.shape.kind === 'spring') {
      if (!spring) throw new Error('Missing helical-wire library configuration.');
      return { ...piece, component: spring(piece, index) };
    }
    const feature = recoveryFeature(piece.shape, segments),
      supplier = recoverySupplier(piece.shape),
      id = 'component-' + (index + 1),
      component = supplier
        ? supplierComponent(id, { ...supplier, libraryId: undefined }, [feature])
        : detailComponent(id, piece.label, feature);
    return { ...piece, component, feature, ...(supplier ? { supplier } : {}) };
  });
}
function physicalPlacement(piece: ConfiguredRecoveryPiece): AssemblyComponent {
  const item = piece.component;
  const wrapper = new Matrix4()
    .makeRotationZ(((piece.angle ?? 0) * Math.PI) / 180)
    .setPosition(...(piece.position ?? [0, 0, piece.z ?? 0]));
  const inner = new Matrix4()
    .makeRotationFromEuler(
      new Euler(...(item.placement.rotation.map((angle) => (angle * Math.PI) / 180) as Vec), 'ZYX'),
    )
    .setPosition(...item.placement.translation);
  const matrix = wrapper.multiply(inner),
    rotation = new Euler().setFromRotationMatrix(matrix, 'ZYX');
  return {
    ...item,
    placement: {
      translation: new Vector3().setFromMatrixPosition(matrix).toArray() as Vec,
      rotation: [rotation.x, rotation.y, rotation.z].map((angle) => (angle * 180) / Math.PI) as Vec,
    },
  };
}
/** Constructor-declared supplier pieces remain one purchase unit, including its installation geometry. */
export function recoveryComposition(
  pieces: readonly ConfiguredRecoveryPiece[],
  issues: string[],
): AssemblyDefinition {
  const components: AssemblyComponent[] = [],
    units = new Map<SupplierUnit, Shape[]>();
  for (const piece of pieces) {
    if (piece.supplier && piece.feature) {
      const features = units.get(piece.supplier) ?? [];
      features.push(piece.feature);
      units.set(piece.supplier, features);
    } else components.push(physicalPlacement(piece));
  }
  for (const [source, features] of units)
    components.push(supplierComponent('supplier-' + (components.length + 1), source, features));
  return { components, issues };
}
