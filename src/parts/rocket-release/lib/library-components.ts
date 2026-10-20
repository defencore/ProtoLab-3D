import { Group, Mesh, MeshStandardMaterial } from 'three';
import type { AssemblyComponent } from '../../../core/product-types';
import { componentGeometry } from '../../../core/assembly/detail-instances';
import { recoveryDetailComponent } from '../../../core/recovery-component-recipes';
import { supplierUnit } from '../../../core/supplier-components';
import type { Shape } from '../../../core/assembly/recovery/shapes';
import detail from '../../recovery-detail/part';
import purchased from '../../purchased-recovery-component/part';
import { servoCadGeometry } from '../../bus-servo/part';
import controller from '../../bus-servo-driver/part';
import { fastenerCatalog } from './fastener-catalog';
import type { Piece } from './assembly';

export function configuredRecoveryPiece(piece: Piece, id: string): AssemblyComponent {
  const catalog = fastenerCatalog(piece.shape);
  const supplier = supplierUnit(piece.shape);
  const buy =
    !!supplier ||
    !!piece.metadata?.SupplierUnitId ||
    (!!catalog && catalog.procurement !== 'MAKE_CUSTOM_FASTENER');
  const configured = recoveryDetailComponent(
    id,
    piece.label,
    piece.shape,
    buy ? 'purchased' : 'manufactured',
  );
  if (catalog && catalog.procurement !== 'MAKE_CUSTOM_FASTENER') {
    configured.supply = 'standard';
    configured.procurement = {
      designation: catalog.designation,
      manufacturer: '',
      source: catalog.source,
      standard: catalog.standard,
    };
  } else if (supplier?.procurement) configured.procurement = supplier.procurement;
  return configured;
}

function supplierGeometry(shape: Shape): Group | undefined {
  if (shape.kind === 'native') return servoCadGeometry(shape.index);
  if (shape.kind === 'hat')
    return controller.buildGeometry({ model: 'waveshare-hat-a' }, 'assembled');
  if (shape.kind !== 'transform' && shape.kind !== 'rotate') return undefined;
  const child = supplierGeometry(shape.child);
  if (!child) return undefined;
  const placed = new Group().add(child);
  if (shape.kind === 'transform') {
    placed.position.set(...shape.offset);
    placed.rotation.z = (shape.angle * Math.PI) / 180;
  } else placed.rotation[shape.axis] = (shape.angle * Math.PI) / 180;
  return placed;
}

/** Supplier internals are rendered by the owning product library; fabricated pieces use local recipes. */
export function recoveryPieceGeometry(piece: Piece): Group {
  const supplied = supplierGeometry(piece.shape);
  if (supplied) {
    supplied.name = piece.label;
    supplied.userData.libraryId = supplierUnit(piece.shape)?.libraryId;
    const isController = (s: Shape): boolean =>
      s.kind === 'hat' ||
      ((s.kind === 'transform' || s.kind === 'rotate') && isController(s.child));
    supplied.traverse((object) => {
      if (object instanceof Mesh) {
        object.name = piece.label;
        if (!isController(piece.shape))
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            if (material instanceof MeshStandardMaterial) material.color.setHex(piece.color);
      }
    });
    return supplied;
  }
  const configured = componentGeometry(
    [detail, purchased],
    [
      {
        component: configuredRecoveryPiece(piece, 'component'),
        label: piece.label,
        color: piece.color,
      },
    ],
  );
  configured.name = piece.label;
  return configured;
}

export function recoveryPiecePython(piece: Piece): string | undefined {
  if (supplierGeometryKind(piece.shape)) return undefined;
  const configured = configuredRecoveryPiece(piece, 'component');
  return [
    (configured.libraryId === detail.id ? detail : purchased).python(
      configured.parameters,
      configured.state,
    ),
    ...configured.placement.rotation.flatMap((angle, index) =>
      angle
        ? [
            `shape.rotate(App.Vector(),App.Vector(${[0, 1, 2].map((axis) => (axis === index ? 1 : 0)).join(',')}),${angle})`,
          ]
        : [],
    ),
    `shape.translate(App.Vector(${configured.placement.translation.join(',')}))`,
  ].join('\n');
}
function supplierGeometryKind(s: Shape): boolean {
  return (
    s.kind === 'native' ||
    s.kind === 'hat' ||
    ((s.kind === 'transform' || s.kind === 'rotate') && supplierGeometryKind(s.child))
  );
}
