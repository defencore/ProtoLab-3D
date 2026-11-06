import type { Parameters } from '../../../core/types';
import type {
  AssemblyComponent,
  AssemblyDefinition,
  ManufacturingDefinition,
  ProcurementDefinition,
  ProductPlacement,
} from '../../../core/product-types';
import {
  componentDimensions,
  componentGeometry,
  componentPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import componentPart, {
  selected as selectedMadePart,
  sourceColorOverrides,
} from '../../rov-component/part';
import servoPart from '../../qfs2025-servo/part';
import thrusterPart from '../../underwater-thruster/part';
import sensorPart from '../../ms5837-depth-sensor/part';
import servoBracketPart from '../../metal-servo-bracket/part';
import servoHornPart from '../../metal-servo-horn/part';
import enclosurePart from '../../underwater-pressure-enclosure/part';
import sourceAssembly from './assembly.json';

export interface FinsOccurrence {
  id: string;
  label: string;
  libraryId: string;
  parameters: Parameters;
  supply: 'manufactured' | 'purchased';
  placement: ProductPlacement;
  manufacturing?: ManufacturingDefinition;
  procurement?: ProcurementDefinition;
  role: 'printed' | 'machined' | 'equipment';
  sourceBounds: [number, number, number, number, number, number];
  sourceVolume: number;
  sourceOccurrenceId: string;
  sourceObject: string;
  notes?: string;
  sourceFit?: { exactRigidFit: boolean; [key: string]: unknown };
}
export interface PurchaseRow {
  id: string;
  name: string;
  quantity: number | null;
  unit: string;
  manufacturer: string;
  designation: string;
  source: string;
  cadUnitCount: number;
  notes: string;
}
export interface FinsAssembly {
  id: 'finsrov';
  name: string;
  revision: string;
  sourceUrl: string;
  sourceSha256: string;
  issues: string[];
  occurrences: FinsOccurrence[];
  bom: { procurement: PurchaseRow[]; [key: string]: unknown };
  verification: {
    id: string;
    component: string;
    sourceSolidCount: number;
    sourceBounds: number[];
    sourceVolume: number;
    symmetricDifferenceMm3: number;
  }[];
}
export const assembly = sourceAssembly as unknown as FinsAssembly;
export const purchasedLibraries = [
  servoPart,
  thrusterPart,
  sensorPart,
  servoBracketPart,
  servoHornPart,
  enclosurePart,
];
const libraries = [componentPart, ...purchasedLibraries];
export const states = ['assembled', 'manufactured', 'printed', 'machined', 'purchased', 'exploded'];

export function validate(p: Parameters, state: string): string[] {
  const errors: string[] = [];
  if (p.model !== assembly.id) errors.push('Choose the FinsROV source assembly.');
  if (Object.keys(p).some((key) => key !== 'model'))
    errors.push(
      'Source assembly geometry and interfaces are fixed; dimension overrides are unsupported.',
    );
  if (!states.includes(state)) errors.push('Choose a supported FinsROV assembly view.');
  for (const item of assembly.occurrences) {
    if (item.supply === 'purchased') {
      if (
        !purchasedLibraries.some((library) => library.id === item.libraryId) ||
        item.role !== 'equipment' ||
        item.manufacturing
      )
        errors.push(`${item.label}: purchased equipment cannot have a fabrication route.`);
      if (
        !item.procurement?.designation ||
        !item.procurement.manufacturer ||
        !item.procurement.source
      )
        errors.push(`${item.label}: purchased equipment requires its procurement identity.`);
    } else {
      if (item.libraryId !== 'rov-component' || !item.manufacturing || item.procurement)
        errors.push(`${item.label}: a made part requires its fabrication definition.`);
      if (item.role === 'printed' && !item.manufacturing?.processes.includes('printing'))
        errors.push(`${item.label}: a printed part must have the printing process.`);
      if (item.role === 'machined' && item.manufacturing?.processes.includes('printing'))
        errors.push(`${item.label}: a machined detail cannot be assigned to printing.`);
    }
  }
  return errors;
}
function requireValid(p: Parameters, state: string) {
  const errors = validate(p, state);
  if (errors.length) throw new Error(errors.join(' '));
}
export function occurrences(): AssemblyComponent[] {
  return assembly.occurrences.map<AssemblyComponent>((item) => ({
    id: item.id,
    name: item.label,
    libraryId: item.libraryId,
    parameters: { ...item.parameters },
    state: 'default',
    quantity: 1,
    placement: {
      translation: [...item.placement.translation],
      rotation: [...item.placement.rotation],
    },
    supply: item.supply,
    manufacturing: item.manufacturing,
    procurement: item.procurement,
    notes: item.notes,
  }));
}
export function composition(p: Parameters): AssemblyDefinition {
  requireValid(p, 'assembled');
  return { components: occurrences(), issues: [...assembly.issues] };
}
function selectedOccurrences(state: string): FinsOccurrence[] {
  return assembly.occurrences.filter((item) => {
    if (state === 'manufactured') return item.supply === 'manufactured';
    if (state === 'printed') return item.role === 'printed';
    if (state === 'machined') return item.role === 'machined';
    if (state === 'purchased') return item.supply === 'purchased';
    return true;
  });
}
const colors = { printed: 0x38ad86, machined: 0xb4bac3, equipment: 0x527899 };
export function pieces(p: Parameters, state: string, forFabrication = false): ConfiguredPiece[] {
  requireValid(p, state);
  if (forFabrication && ['purchased', 'machined'].includes(state))
    throw new Error(
      'Purchased equipment is bought; machined parts use FreeCAD/STEP. Choose Printed parts for 3D printing.',
    );
  const all = new Map(occurrences().map((item) => [item.id, item]));
  const selected = selectedOccurrences(state).filter(
    (item) => !forFabrication || (item.supply === 'manufactured' && item.role === 'printed'),
  );
  const printBounds = forFabrication
    ? selected.map((item) => selectedMadePart(item.parameters))
    : [];
  const columnWidth = forFabrication
    ? Math.max(...printBounds.map((item) => item.dimensions[0])) + 10
    : 0;
  const rowDepth = forFabrication
    ? Math.max(...printBounds.map((item) => item.dimensions[1])) + 10
    : 0;
  return selected.map<ConfiguredPiece>((item, index) => {
    const component = all.get(item.id)!;
    if (forFabrication) {
      const source = printBounds[index];
      // Original standalone making-file orientation, placed on the print bed.
      // Installed rotations remain in composition() and the assembly preview.
      component.placement = {
        rotation: [0, 0, 0],
        translation: [
          (index % 2) * columnWidth - source.bounds[0],
          Math.floor(index / 2) * rowDepth - source.bounds[1],
          -source.bounds[2],
        ],
      };
    }
    return {
      component,
      requireSingleSolid: item.supply === 'manufactured',
      label: `${item.supply === 'purchased' ? 'BUY' : item.role === 'printed' ? 'PRINT' : 'MACHINE'} · ${item.label}`,
      color: sourceColorOverrides[String(item.parameters.component)] ?? colors[item.role],
      preserveLibraryAppearance: item.supply === 'purchased',
      // Inspection separation is outside the physical occurrence placement.
      position:
        state === 'exploded' && !forFabrication
          ? [
              ((index % 5) - 2) * 30,
              ((Math.floor(index / 5) % 5) - 2) * 30,
              Math.floor(index / 25) * 40,
            ]
          : [0, 0, 0],
    };
  });
}
export function geometry(p: Parameters, state: string) {
  return componentGeometry(libraries, pieces(p, state));
}
export function exportGeometry(p: Parameters, state: string) {
  return componentGeometry(libraries, pieces(p, state, true), true);
}
export function dimensions(p: Parameters, state: string): [number, number, number] {
  return componentDimensions(libraries, pieces(p, state));
}
export function exportDimensions(p: Parameters, state: string): [number, number, number] {
  // This contract validates native FreeCAD geometry. STL computes its own
  // envelope from buildExportGeometry, which is deliberately print-only.
  return dimensions(p, state);
}
export function python(p: Parameters, state: string): string {
  const selected = pieces(p, state);
  const sourceOccurrences = new Map(assembly.occurrences.map((item) => [item.id, item]));
  const records = selected.map(({ component }) => {
    const source = sourceOccurrences.get(component.id)!;
    return {
      ManufacturingDefinition: JSON.stringify(component.manufacturing ?? null),
      ProcurementDefinition: JSON.stringify(component.procurement ?? null),
      ManufacturingProcesses: JSON.stringify(component.manufacturing?.processes ?? []),
      SourceOccurrenceId: source.sourceOccurrenceId,
      SourceObject: source.sourceObject,
      SourceFit: JSON.stringify(source.sourceFit ?? null),
    };
  });
  return [
    componentPython(libraries, selected),
    `for index, manufacturing_record in enumerate(json.loads(${JSON.stringify(JSON.stringify(records))})):\n    component_metadata[index].update(manufacturing_record)`,
  ].join('\n');
}
