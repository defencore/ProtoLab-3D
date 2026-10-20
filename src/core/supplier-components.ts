import type { Parameters } from './types';
import { Matrix4, Euler, Vector3 } from 'three';
import type { AssemblyComponent, ProductPlacement, ProcurementDefinition } from './product-types';
import { detailComponent } from './component-recipes';
import type { Shape } from './assembly/boundary/shapes';

export interface SupplierUnit {
  name: string;
  libraryId?: string;
  parameters?: Parameters;
  state?: string;
  presetId?: string;
  placement?: ProductPlacement;
  procurement?: ProcurementDefinition;
}
// Provenance is attached by the supplier-product constructor, never guessed from mesh labels.
const provenance = new WeakMap<object, SupplierUnit>();
export function markSupplierUnit(shapes: readonly object[], source: SupplierUnit): void {
  for (const shape of shapes) provenance.set(shape, source);
}
export function supplierUnit(shape: { kind: string; child?: unknown }): SupplierUnit | undefined {
  return (
    provenance.get(shape) ??
    (['transform', 'rotate'].includes(shape.kind) && shape.child && typeof shape.child === 'object'
      ? supplierUnit(shape.child as { kind: string })
      : undefined)
  );
}
/** Resolve the library frame from enclosing placements, rather than an internal cap. */
export function supplierPlacement(shape: object, source: SupplierUnit): ProductPlacement {
  let current = shape as {
    kind: string;
    child?: object;
    translation?: [number, number, number];
    rotation?: [number, number, number];
    angle?: number;
    offset?: [number, number, number];
    axis?: 'x' | 'y';
  };
  const matrix = new Matrix4();
  while (provenance.get(current) !== source) {
    if (!['transform', 'rotate'].includes(current.kind) || !current.child)
      throw new Error('Supplier component has no consistent library placement.');
    let local: Matrix4;
    if (current.kind === 'rotate' && current.angle !== undefined)
      local =
        current.axis === 'x'
          ? new Matrix4().makeRotationX((current.angle * Math.PI) / 180)
          : new Matrix4().makeRotationY((current.angle * Math.PI) / 180);
    else if (current.offset && current.angle !== undefined)
      local = new Matrix4()
        .makeRotationZ((current.angle * Math.PI) / 180)
        .setPosition(...current.offset);
    else if (current.translation && current.rotation)
      local = new Matrix4()
        .makeRotationFromEuler(
          new Euler(
            ...(current.rotation.map((n) => (n * Math.PI) / 180) as [number, number, number]),
            'ZYX',
          ),
        )
        .setPosition(...current.translation);
    else throw new Error('Supplier component has an invalid placement.');
    matrix.multiply(local);
    current = current.child as typeof current;
  }
  const rotation = new Euler().setFromRotationMatrix(matrix, 'ZYX');
  return {
    translation: new Vector3().setFromMatrixPosition(matrix).toArray() as [number, number, number],
    rotation: [rotation.x, rotation.y, rotation.z].map((n) => (n * 180) / Math.PI) as [
      number,
      number,
      number,
    ],
  };
}

export function supplierComponent(
  id: string,
  source: SupplierUnit,
  shapes: Shape[],
): AssemblyComponent {
  if (source.libraryId && source.parameters && source.state && source.placement)
    return {
      id,
      name: source.name,
      libraryId: source.libraryId,
      parameters: structuredClone(source.parameters),
      state: source.state,
      quantity: 1,
      supply: 'purchased',
      placement: structuredClone(source.placement),
      ...(source.presetId ? { presetId: source.presetId } : {}),
      ...(source.procurement ? { procurement: source.procurement } : {}),
    };
  const detail = detailComponent(
    id,
    source.name,
    shapes.length === 1 ? shapes[0] : { kind: 'union', children: shapes },
  );
  return {
    ...detail,
    libraryId: 'purchased-component',
    supply: 'purchased',
    ...(source.procurement ? { procurement: source.procurement } : {}),
  };
}
