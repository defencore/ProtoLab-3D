import type { AssemblyComponent, ManufacturingProcess } from '../../../core/product-types';
import type { Parameters, PartDefinition } from '../../../core/types';
import { configureProduct } from '../../../core/design-project';
import { recoveryDetailComponent } from '../../../core/recovery-component-recipes';
import { union } from '../../../core/assembly/recovery/shapes';
import { fastenerCatalog } from '../../rocket-release/lib/fastener-catalog';
import cartridge from '../../co2-cartridge/part';
import cell from '../../li-ion-cell/part';
import lch7 from '../../lch7-controller/part';
import zx908 from '../../gps-tracker/part';
import jhe20b from '../../recovery-buzzer/part';
import pwm from '../../pwm-switch/part';
import type { Piece } from './model';

const moduleParts: Record<string, PartDefinition> = {
  'lch7-v3-2': lch7,
  zx908,
  jhe20b,
  'pwm-switch-17x13': pwm,
};
export function libraryPart(library: NonNullable<Piece['library']>): PartDefinition {
  const part =
    library.kind === 'cell'
      ? cell
      : library.kind === 'cartridge'
        ? cartridge
        : moduleParts[library.model];
  if (!part) throw new Error('Unknown library module: ' + library.model);
  return part;
}
export const libraryState = (library: NonNullable<Piece['library']>) =>
  library.kind === 'cartridge' ? 'sealed' : 'assembled';

/** Authored route tokens determine make/buy; display labels never determine product type. */
function manufacturingRoute(process: string): ManufacturingProcess[] {
  const operations: ManufacturingProcess[] = [];
  for (const token of process.split('/').map((value) => value.trim())) {
    const operation: ManufacturingProcess | undefined = {
      TURN: 'turning',
      THREAD: 'turning',
      DRILL: 'drilling',
      TAP: 'drilling',
      CUT: 'cutting',
      'LASER CUT': 'cutting',
      'TURN EXIT RADIUS': 'turning',
      '3D PRINT': 'printing',
      MOULD: 'moulding',
      MOLD: 'moulding',
      BOND: 'assembly',
      FORM: 'bending',
      'SPOT WELD': 'assembly',
    }[token] as ManufacturingProcess | undefined;
    if (operation && !operations.includes(operation)) operations.push(operation);
    else if (!operation && !['MAKE', 'DEBURR', 'POLISH', 'FIT REFERENCE'].includes(token))
      throw new Error('Unsupported authored CO2 manufacturing process: ' + token);
  }
  if (!operations.length) throw new Error('A manufactured CO2 detail needs an authored route.');
  return operations;
}

export function pieceComponent(piece: Piece, index: number): AssemblyComponent | undefined {
  if (piece.process === 'REFERENCE') return undefined;
  const id = `co2-component-${index + 1}`;
  const notes = [
    `Organization: ${piece.group?.join(' / ') ?? 'Unassigned'}`,
    `Authored process: ${piece.process}`,
    ...Object.entries(piece.metadata ?? {}).map(([key, value]) => `${key}: ${value}`),
  ].join('\n');
  if (piece.library) {
    const source = piece.library;
    const part = libraryPart(source);
    const parameters: Parameters = { ...part.defaults, model: source.model };
    const preset = part.presets.find((item) =>
      Object.entries(item.parameters).every(([key, value]) => parameters[key] === value),
    );
    const selected = configureProduct({
      part,
      parameters,
      state: libraryState(source),
      presetId: preset?.id,
    });
    return {
      id,
      name: piece.label,
      libraryId: part.id,
      parameters,
      state: selected.state,
      ...(preset ? { presetId: preset.id } : {}),
      supply: 'purchased',
      quantity: 1,
      procurement: selected.procurement,
      notes,
      placement: {
        translation: [...source.offset],
        rotation: [source.inverted ? 180 : 0, 0, source.azimuth ?? 0],
      },
    };
  }
  if (!piece.shape)
    throw new Error('A physical CO2 component needs a library or detail definition.');
  const purchased = piece.process.startsWith('BUY');
  const configured = recoveryDetailComponent(
    id,
    piece.label,
    piece.shape,
    purchased ? 'purchased' : 'manufactured',
  );
  configured.notes = notes;
  if (purchased) {
    const catalog = fastenerCatalog(piece.shape, piece.label);
    configured.procurement = {
      designation:
        catalog && catalog.procurement !== 'MAKE_CUSTOM_FASTENER'
          ? catalog.designation
          : piece.label,
      manufacturer: piece.metadata?.SupplierManufacturer ?? '',
      source: catalog?.source ?? piece.metadata?.SupplierSource ?? '',
      ...(catalog && catalog.procurement !== 'MAKE_CUSTOM_FASTENER'
        ? { standard: catalog.standard }
        : {}),
    };
  } else
    configured.manufacturing = {
      material: piece.material,
      blank: piece.metadata?.Stock ?? '',
      processes: manufacturingRoute(piece.process),
      requirements: [
        `Authored operation sequence: ${piece.process}.`,
        ...Object.entries(piece.metadata ?? {}).map(([key, value]) => `${key}: ${value}`),
        'Assign datums, tolerances, qualified process and inspection before manufacturing.',
      ],
    };
  return configured;
}

/** Supplier electronics are one purchased kit; mounting hardware remains separate. */
export function compositionComponents(pieces: Piece[]): AssemblyComponent[] {
  const units = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const unit = piece.metadata?.SupplierUnitId;
    if (unit) {
      if (!piece.shape || !piece.process.startsWith('BUY'))
        throw new Error('A supplier unit needs explicit purchased source shapes.');
      units.set(unit, [...(units.get(unit) ?? []), piece]);
    }
  }
  const emitted = new Set<string>();
  return pieces.flatMap((piece, index) => {
    const unit = piece.metadata?.SupplierUnitId;
    if (!unit) {
      const component = pieceComponent(piece, index);
      return component ? [component] : [];
    }
    if (emitted.has(unit)) return [];
    emitted.add(unit);
    const members = units.get(unit)!;
    const configured = recoveryDetailComponent(
      `co2-supplier-${unit}`,
      piece.metadata!.SupplierUnitName,
      union(...members.map((item) => item.shape!)),
      'purchased',
    );
    configured.procurement = {
      designation: piece.metadata!.SupplierUnitName,
      manufacturer: piece.metadata!.SupplierManufacturer,
      source: piece.metadata!.SupplierSource,
    };
    configured.notes = `Organization: ${piece.group?.join(' / ')}\n${piece.metadata!.SupplierScope}`;
    return [configured];
  });
}
