/** Inventory native geometry recipes without replacing source CAD or changing product parameters. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parts } from '../src/parts';
import { withGeometryMode } from '../src/core/geometry-mode';
import { freecadAppearancePython } from '../src/core/freecad-appearance';

const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf('--' + name);
  return i < 0 ? fallback : args[i + 1];
};
const destination = option('output', 'test-results/native-geometry-audit/inventory.json');
const ids = option('parts', '').split(',').filter(Boolean);
if (ids.some((id) => !parts.some((part) => part.id === id))) throw new Error('Unknown part ID.');
const selected = parts.filter((part) => !ids.length || ids.includes(part.id));
type Row = {
  id: string;
  name: string;
  state: string;
  bytes?: number;
  polygons?: number;
  shells?: number;
  cylinders?: number;
  arcs?: number;
  revolves?: number;
  nativeImports?: number;
  helix?: number;
  error?: string;
};
const rows: Row[] = [];
for (const part of selected) {
  const states = part.states
    ?.filter((state) => !state.availableWhen || state.availableWhen(part.defaults))
    .map((state) => state.id) ?? ['default'];
  for (const state of states) {
    const row: Row = { id: part.id, name: part.name, state };
    try {
      await part.initializeGeometry?.(part.defaults, state);
      const python = withGeometryMode('simple', () => part.python(part.defaults, state));
      const count = (expression: RegExp) => (python.match(expression) ?? []).length;
      Object.assign(row, {
        bytes: Buffer.byteLength(python),
        polygons: count(/Part\.makePolygon\(/g),
        shells: count(/Part\.makeShell\(/g),
        cylinders: count(/Part\.makeCylinder\(/g),
        arcs: count(/Part\.Arc\(|Part\.ArcOfCircle\(|Part\.Circle\(|Part\.makeCircle\(/g),
        revolves: count(/\.revolve\(/g),
        nativeImports: count(/importBrepFromString|readBrep|\.read\(|base64\.b64decode/g),
        helix: count(/make(?:Long)?Helix\(/g),
      });
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }
    rows.push(row);
  }
}
const standalone = readFileSync('src/core/freecad.ts', 'utf8');
const project = readFileSync('src/core/project-freecad.ts', 'utf8');
const shaded = freecadAppearancePython.includes('view.DisplayMode = "Shaded"');
const explicitMaterials = freecadAppearancePython.includes('view.ShapeAppearance = [material]');
const wrapperPolicy = {
  standaloneUsesSharedAppearance:
    standalone.includes('${freecadAppearancePython}') &&
    standalone.includes('_protolab_apply_color(display_object.ViewObject'),
  projectUsesSharedAppearance:
    project.includes('${freecadAppearancePython}') &&
    project.includes('_protolab_apply_color(child.ViewObject'),
  shaded,
  explicitMaterials,
  coveredLibraryIds: selected.map((part) => part.id),
  statement:
    'All listed IDs use the common standalone/project export wrappers. This verifies policy routing, not native GUI rendering of every configuration.',
};
const perFamily = selected.map((part) => {
  const generated = rows.filter((row) => row.id === part.id && row.bytes !== undefined);
  return {
    id: part.id,
    name: part.name,
    states: generated.length,
    maxRecipeBytes: Math.max(0, ...generated.map((row) => row.bytes!)),
    polygonWires: generated.some((row) => row.polygons),
    explicitShells: generated.some((row) => row.shells),
    nativeImports: generated.some((row) => row.nativeImports),
    declaredNativeCadPresets: part.presets.filter((preset) =>
      ['manufacturer-cad', 'community-cad'].includes(preset.catalog?.geometryEvidence?.kind ?? ''),
    ).length,
  };
});
const report = {
  checkedAt: new Date().toISOString(),
  scope:
    'All selected families at default parameters and available states in Simple mode. Native code markers identify review candidates, not proof that a polygon or loft is unnecessary. Freeform surfaces and retained manufacturer/community CAD remain legitimate geometry.',
  families: selected.length,
  states: rows.length,
  generated: rows.filter((row) => !row.error).length,
  errors: rows.filter((row) => row.error),
  wrapperPolicy,
  polygonFamilies: perFamily.filter((family) => family.polygonWires).length,
  shellFamilies: perFamily.filter((family) => family.explicitShells).length,
  nativeImportFamilies: perFamily.filter((family) => family.nativeImports).length,
  perFamily,
  rows,
};
mkdirSync(path.dirname(destination), { recursive: true });
writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      families: report.families,
      states: report.states,
      generated: report.generated,
      errors: report.errors,
      wrapperPolicy: { ...wrapperPolicy, coveredLibraryIds: undefined },
      output: path.resolve(destination),
    },
    null,
    2,
  ),
);
if (report.errors.length || !Object.values(wrapperPolicy).every((value) => value !== false))
  process.exitCode = 1;
