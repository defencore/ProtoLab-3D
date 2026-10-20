import { Matrix4, Euler, Vector3 } from 'three';
import type { Parameters } from './types';
import type { AssemblyComponent, AssemblyDefinition, ProductPlacement } from './product-types';
import type { Shape, Vec } from './assembly/boundary/shapes';
import { detailComponent } from './component-recipes';
import {
  supplierComponent,
  supplierPlacement,
  supplierUnit,
  type SupplierUnit,
} from './supplier-components';

interface SourceShape {
  kind: string;
  child?: SourceShape;
  parameters?: Parameters;
  state?: string;
  translation?: Vec;
  rotation?: Vec;
}
interface PhysicalPiece {
  label: string;
  shape: SourceShape;
  procurement: 'MAKE' | 'BUY' | 'REFERENCE';
}
const placement = (matrix: Matrix4): ProductPlacement => {
  const r = new Euler().setFromRotationMatrix(matrix, 'ZYX');
  return {
    translation: new Vector3().setFromMatrixPosition(matrix).toArray() as Vec,
    rotation: [r.x, r.y, r.z].map((n) => (n * 180) / Math.PI) as Vec,
  };
};
function library(
  shape: SourceShape,
):
  | { libraryId: string; parameters: Parameters; state: string; placement: ProductPlacement }
  | undefined {
  const matrix = new Matrix4();
  let s = shape;
  while (s.kind === 'transform') {
    if (!s.translation || !s.rotation || !s.child) throw new Error('Invalid library placement.');
    matrix.multiply(
      new Matrix4()
        .makeRotationFromEuler(
          new Euler(...(s.rotation.map((n) => (n * Math.PI) / 180) as Vec), 'ZYX'),
        )
        .setPosition(...s.translation),
    );
    s = s.child;
  }
  if (s.kind !== 'library-guide' && s.kind !== 'library-ball-screw') return;
  if (!s.parameters || !s.state) throw new Error('Invalid library occurrence.');
  return {
    libraryId: s.kind === 'library-guide' ? 'linear-guide' : 'ball-screw',
    parameters: structuredClone(s.parameters),
    state: s.state,
    placement: placement(matrix),
  };
}
/** A declared physical source, including supplier constructor provenance, is the composition source. */
export function machineComposition(
  pieces: readonly PhysicalPiece[],
  issues: string[],
): AssemblyDefinition {
  const components: AssemblyComponent[] = [],
    groups = new Map<SupplierUnit, { shapes: Shape[]; placement: ProductPlacement }>();
  for (const piece of pieces) {
    if (piece.procurement === 'REFERENCE') continue;
    const ref = library(piece.shape);
    if (ref) {
      components.push({
        id: 'component-' + (components.length + 1),
        name: piece.label,
        ...ref,
        supply: 'purchased',
        quantity: 1,
      });
      continue;
    }
    const source = supplierUnit(piece.shape);
    if (source) {
      const unit = groups.get(source) ?? {
        shapes: [],
        placement: supplierPlacement(piece.shape, source),
      };
      unit.shapes.push(piece.shape as Shape);
      groups.set(source, unit);
      continue;
    }
    const item = detailComponent(
      'component-' + (components.length + 1),
      piece.label,
      piece.shape as Shape,
    );
    components.push(
      piece.procurement === 'MAKE'
        ? item
        : { ...item, libraryId: 'purchased-component', supply: 'purchased' },
    );
  }
  for (const [source, unit] of groups)
    components.push(
      supplierComponent(
        'supplier-' + (components.length + 1),
        { ...source, placement: source.placement ?? unit.placement },
        unit.shapes,
      ),
    );
  return { components, issues };
}
