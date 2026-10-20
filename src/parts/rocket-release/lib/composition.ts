import type { Parameters } from '../../../core/types';
import type { AssemblyDefinition, AssemblyComponent } from '../../../core/product-types';
import {
  supplierPlacement,
  supplierUnit,
  type SupplierUnit,
} from '../../../core/supplier-components';
import { recoveryDetailComponent } from '../../../core/recovery-component-recipes';
import { threadFeatures } from '../../../core/assembly/recovery/thread-features';
import type { Shape } from '../../../core/assembly/recovery/shapes';
import type { Piece } from './assembly';
import { configuredRecoveryPiece } from './library-components';
import { pieces } from './model';

/** Canonical physical source records, independent of mesh triangulation, names and inspection views. */
export function recoveryPiecesComposition(authored: readonly Piece[]): AssemblyDefinition {
  const components: AssemblyComponent[] = [];
  const units = new Map<SupplierUnit | string, { source?: SupplierUnit; pieces: Piece[] }>();
  for (const piece of authored) {
    const source = supplierUnit(piece.shape),
      kit = piece.metadata?.SupplierUnitId;
    if (source || kit) {
      const key = source ?? kit!,
        entry = units.get(key) ?? { source, pieces: [] };
      entry.pieces.push(piece);
      units.set(key, entry);
      continue;
    }
    const component = configuredRecoveryPiece(piece, 'component-' + (components.length + 1));
    if (component.supply === 'manufactured')
      component.manufacturing = {
        material: '',
        blank: '',
        processes: [],
        requirements: [
          'Assign the actual material, blank and qualified machining, printing or forming route; verify one physical detail and drawing datums.',
          ...threadFeatures(piece.shape).map(
            (t) =>
              (t.internal ? 'Internal ' : 'External ') +
              t.designation +
              '; nominal tool length ' +
              t.length +
              ' mm; verify engagement and tolerance class.',
          ),
        ],
      };
    components.push(component);
  }
  for (const entry of units.values()) {
    const source = entry.source,
      first = entry.pieces[0];
    const id = 'supplier-' + (components.length + 1);
    if (source?.libraryId && source.parameters && source.state)
      components.push({
        id,
        name: source.name,
        libraryId: source.libraryId,
        parameters: structuredClone(source.parameters),
        state: source.state,
        quantity: 1,
        supply: 'purchased',
        placement: source.placement ?? supplierPlacement(first.shape, source),
        ...(source.procurement ? { procurement: source.procurement } : {}),
      });
    else {
      const shape: Shape =
        entry.pieces.length === 1
          ? first.shape
          : { kind: 'union', children: entry.pieces.map((piece) => piece.shape) };
      const item = recoveryDetailComponent(
        id,
        source?.name ?? first.metadata!.SupplierUnitName,
        shape,
        'purchased',
      );
      item.procurement = source?.procurement ?? {
        designation: first.metadata!.SupplierUnitName,
        manufacturer: first.metadata!.SupplierManufacturer ?? '',
        source: first.metadata!.SupplierSource ?? '',
      };
      item.notes =
        first.metadata?.SupplierScope ??
        'One supplier unit; internal installation visuals do not create additional procurement items.';
      components.push(item);
    }
  }
  return {
    components,
    issues: [
      'Custom details require material, blank, manufacturing route, tolerances, fit and load review before release.',
      'Installation envelopes require a selected supplier product and verified mounting, electrical and retaining interfaces.',
    ],
  };
}
export function composition(p: Parameters): AssemblyDefinition {
  return recoveryPiecesComposition(pieces({ ...p, release: 0 }, 'assembled'));
}
