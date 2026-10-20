/** Reproducible DIY handoff, explicitly a draft with no manufacturing approval. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import machine, { millingLibraries, millingPieces } from '../src/parts/cnc-milling-machine/part';
import {
  addProduct,
  createProject,
  projectReadiness,
  serializeProject,
  specificationRows,
  supplyRows,
  specificationCsv,
} from '../src/core/design-project';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import { millingStructuralScreen } from '../src/parts/cnc-milling-machine/lib/qualification';
import { portalTieStockInput } from '../src/parts/cnc-milling-machine/lib/portal';
import {
  millingDesignRequirement,
  millingAccuracyAllocation,
  millingAcceptanceRequirements,
} from '../src/parts/cnc-milling-machine/lib/requirements';

const destination = resolve('test-results/cnc-milling/precision-build-draft');
if (existsSync(destination)) {
  const archive = resolve('test-results/cnc-milling/attempts', 'build-draft-' + Date.now());
  mkdirSync(resolve(archive, '..'), { recursive: true });
  renameSync(destination, archive);
}
const definitions = [machine, ...millingLibraries];
const draft = createProject('ProtoLab CNC / UNRELEASED engineering draft');
const { project, occurrenceId } = addProduct(draft, definitions, {
  part: machine,
  parameters: machine.defaults,
  state: 'assembled',
});
const readiness = projectReadiness(project, definitions);
if (readiness.complete) throw new Error('An unqualified machine must not be exported as released.');
mkdirSync(destination, { recursive: true });
writeFileSync(
  resolve(destination, 'cnc-build-draft.project.json'),
  serializeProject(project, definitions),
);
const purchaseRows = supplyRows(project, definitions, 'purchased').map((row) => {
  const configuration = project.configurations.find((one) => one.id === row.configurationId)!;
  const part = definitions.find((one) => one.id === configuration.libraryId)!;
  return {
    ...row,
    notes: [
      row.notes,
      `Library: ${part.name} (${part.id}); configuration: ${configuration.id}; state: ${configuration.state}`,
      `Configured parameters: ${JSON.stringify(configuration.parameters)}`,
      'Configured CAD geometry is not a released supplier drawing. Confirm stock execution, material/property class and delivered fits before ordering.',
    ]
      .filter(Boolean)
      .join(' | '),
  };
});
for (const [filename, rows] of [
  ['specification.csv', specificationRows(project, definitions)],
  ['machine-specification.csv', specificationRows(project, definitions, occurrenceId)],
  ['manufacturing.csv', supplyRows(project, definitions, 'manufactured')],
  ['purchasing.csv', purchaseRows],
] as const)
  writeFileSync(resolve(destination, filename), specificationCsv(rows, project.documentationRules));

const files: {
  configurationId: string;
  libraryId: string;
  name: string;
  quantity: number;
  macros: Record<string, string>;
  hashes: Record<string, string>;
}[] = [];
const fabricated = supplyRows(project, definitions, 'manufactured');
const tieCuts = millingPieces(machine.defaults, 'assembled').filter(
  ({ component }) =>
    component.libraryId === portalTieStockInput.libraryId &&
    component.supply === 'manufactured' &&
    /^portal-post-.*-tie-/.test(component.id),
);
if (
  !tieCuts.length ||
  tieCuts.some(({ component }) => component.parameters.length !== portalTieStockInput.cutLengthMm)
)
  throw new Error('The raw-stock plan does not match the actual installed portal cuts.');
const portalStockPlan = {
  ...portalTieStockInput,
  finishedQuantity: tieCuts.length,
  minimumStockBars: Math.ceil(tieCuts.length / portalTieStockInput.maximumCutsPerBar),
  unusedLengthPerThreeCutBarMm:
    portalTieStockInput.stockLengthMm -
    portalTieStockInput.maximumCutsPerBar * portalTieStockInput.cutLengthMm,
  scope: 'Portal tie raw-stock input only; other detail blanks remain in manufacturing.csv.',
  releaseCondition:
    'Confirm delivered class8.8 certificate, supplier DIN975/DIN976 execution, usable threaded length, kerf/end allowance and released cut-length tolerance. This stock input is separate from the finished manufactured cuts; do not order those cuts as supplier SKUs.',
};
const stockColumns = [
  'Stock library ID',
  'Stock preset ID',
  'Source',
  'Stock length mm',
  'Finished length mm',
  'Finished quantity',
  'Maximum cuts per bar',
  'Minimum stock bars',
  'Release condition',
];
writeFileSync(
  resolve(destination, 'portal-tie-stock.csv'),
  [
    stockColumns,
    [
      portalStockPlan.libraryId,
      portalStockPlan.presetId,
      portalStockPlan.source,
      portalStockPlan.stockLengthMm,
      portalStockPlan.cutLengthMm,
      portalStockPlan.finishedQuantity,
      portalStockPlan.maximumCutsPerBar,
      portalStockPlan.minimumStockBars,
      portalStockPlan.releaseCondition,
    ],
  ]
    .map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(','))
    .join('\n') + '\n',
);
for (const row of fabricated) {
  const configuration = project.configurations.find((one) => one.id === row.configurationId)!;
  if (configuration.libraryId === machine.id) continue;
  const part = definitions.find((one) => one.id === configuration.libraryId)!;
  const safe = configuration.name.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '');
  const name = `${String(files.length + 1).padStart(3, '0')}-${safe}`;
  const record = {
    configurationId: configuration.id,
    libraryId: part.id,
    name: configuration.name,
    quantity: Number(row.quantity),
    macros: {} as Record<string, string>,
    hashes: {} as Record<string, string>,
  };
  for (const mode of ['simple', 'full'] as const) {
    mkdirSync(resolve(destination, mode), { recursive: true });
    const relative = `${mode}/${name}.FCMacro`;
    const script = generateScript(
      // Threads do not change these manufactured blanks' outer stock envelope.
      // Use their complete Simple bounds for metadata, while native geometry still uses
      // the requested mode. This avoids tessellating internal helices just for bounds.
      { ...part, dimensions: (p, s) => withGeometryMode('simple', () => part.dimensions(p, s)) },
      configuration.parameters,
      configuration.state,
      configuration.presetId,
      configuration,
      mode,
    );
    writeFileSync(resolve(destination, relative), script);
    record.macros[mode] = relative;
    record.hashes[mode] = createHash('sha256').update(script).digest('hex');
  }
  files.push(record);
}
const geometryHashes = Object.fromEntries(
  ['simple', 'full'].map((mode) => [
    mode,
    createHash('sha256')
      .update(
        withGeometryMode(mode as 'simple' | 'full', () =>
          machine.python(machine.defaults, 'assembled'),
        ),
      )
      .digest('hex'),
  ]),
);
const manifest = {
  status: 'unreleased-engineering-draft',
  expectedBounds:
    'Complete Simple geometry outer envelopes; actual macro geometry follows its selected Simple/Full mode.',
  purpose:
    'Project import, root and machine-level specifications, exact component identities, quantity lists and per-detail inspection macros. No drawings, tolerances or approval are invented.',
  physicalComponents: millingPieces(machine.defaults, 'assembled').length,
  projectOccurrenceCount: project.occurrences.length,
  configurations: project.configurations.length,
  geometryHashes,
  readiness,
  designRequirement: millingDesignRequirement,
  accuracyAllocation: millingAccuracyAllocation,
  acceptanceRequirements: millingAcceptanceRequirements,
  structuralScreening: millingStructuralScreen(machine.defaults),
  fabricatedConfigurations: files,
  portalStockPlan,
  limitations: [
    'Macros are inspection models, not released manufacturing drawings or CAM programs.',
    'Simple removes physical thread flanks; Full retains the modeled inspection allowance. Specify actual tap/drill dimensions and thread fit on drawings.',
    'Purchase complete supplier motors, spindles, factory-matched guide sets, screw/nut kits and encoder kits. Internal visualization is not a recipe for manufacturing purchased units.',
    'Order three factory-matched ground screw/nut sets with approved custom end drawings. C3 accuracy, actual preload, bearing fits and assembled runout remain delivered-product acceptance requirements.',
    'Long datum faces and unspecified hollow-section stock require a verified workshop/fabrication route.',
    'Purchasing notes include exact library/configuration references and configured parameters. Empty designation fields are unresolved release data, not generic approval to order an unnamed fastener.',
  ],
};
writeFileSync(resolve(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(
  resolve(destination, 'README.md'),
  `# ProtoLab CNC: component build draft

Import \`cnc-build-draft.project.json\` through **Design projects**. It retains the actual library configurations, assembly placements and configured enterprise documentation rules. This revision has ${manifest.physicalComponents} physical leaves and ${manifest.configurations} configurations; purchased matched sets retain their installed children without duplicate purchasing orders.

Use \`machine-specification.csv\` for the machine tree, \`manufacturing.csv\` for detail blanks/routes and \`purchasing.csv\` for bought units and their sources. The ${files.length} manufactured configurations have separate editable macros in \`simple/\` and \`full/\`; Simple omits thread flanks and Full includes them. Release actual drawings and fits before making the details.

\`portal-tie-stock.csv\` is a separate raw-stock cutting input, not a finished-part purchasing row: ${portalStockPlan.minimumStockBars} certified ${portalStockPlan.stockLengthMm} mm M10 bars supply ${portalStockPlan.finishedQuantity} cuts at ${portalStockPlan.cutLengthMm} mm. Confirm usable thread, kerf, end allowance and released length tolerance before cutting. Other blanks remain in the manufacturing list.

The D16T finished-part target is a complete 0.05 mm tolerance field, or +/-0.025 mm. Geometry checks and member screening do not certify assembled stiffness or machining accuracy. The manifest preserves unresolved drawings, material/source certificates, joint preload, calibration, thermal and loaded coupon acceptance requirements. Status: **unreleased engineering draft**.
`,
);
console.log(
  JSON.stringify({
    destination,
    physicalComponents: manifest.physicalComponents,
    configurations: manifest.configurations,
    fabricatedConfigurations: files.length,
    readinessIssues: readiness.issues.length,
    status: manifest.status,
  }),
);
