/** Package current, validated 3S/4S module exports without distributing machine G-code.
 *
 * Run after native export and slicer refresh:
 *   node --import tsx scripts/package-panel-battery-module.ts
 *   node --import tsx scripts/package-panel-battery-module.ts --check
 * Inspect the planned input list/BOM without touching delivery files:
 *   node --import tsx scripts/package-panel-battery-module.ts --plan
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import part from '../src/parts/panel-battery-module/part';
import { configuredPieces, printedIds } from '../src/parts/panel-battery-module/lib/model';
import { layout } from '../src/parts/panel-battery-module/lib/layout';
import type { AssemblyComponent } from '../src/core/product-types';
import type { Parameters } from '../src/core/types';

type Pack = '3S' | '4S';
interface InputFile {
  source: string;
  path: string;
}
interface FileRecord {
  path: string;
  bytes: number;
  sha256: string;
  source: string;
}
interface NativeCase {
  id: string;
  state: string;
  codeSHA256: string;
  result: string;
  sourceRetentionEngagement: unknown[];
  printParts: { id: string; stl: string; step: { file: string } }[];
  export?: { fcstd: string; step: { file: string } };
}
interface PreparedCase {
  id: string;
  state: string;
  parameters: Parameters;
  code: string;
  wrapper?: string;
}
interface SlicedPart {
  part: string;
  sourceSha256: string;
  nativeCodeSHA256: string;
  passed: boolean;
  processExitCode: number;
}
interface SlicerProfile {
  file: string;
  sha256: string;
}

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
if (args.some((arg) => !['--check', '--plan'].includes(arg)))
  throw new Error('Usage: package-panel-battery-module.ts [--check | --plan]');
if (args.includes('--check') && args.includes('--plan'))
  throw new Error('Choose --check or --plan.');
const output = resolve(root, 'test-results/panel-battery-module');
const slicerDirectory = 'slicer-audit-spring-lock';
let additionalProfiles: SlicerProfile[] = [];
let additionalSlicerEvidence: SlicerProfile[] = [];
const packs: Pack[] = ['3S', '4S'];
const templateNames = [
  'panel.svg',
  'panel.dxf',
  'panel-holes.csv',
  'main-pcb.svg',
  'main-pcb.dxf',
  'main-pcb-holes.csv',
  'templates.json',
];
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
function fail(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const json = async <T>(path: string): Promise<T> =>
  JSON.parse(await readFile(resolve(output, path), 'utf8')) as T;
const parameters = (pack: Pack): Parameters => ({ ...part.defaults, pack });
const csv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function bom(pack: Pack): { csv: string; rows: number; occurrences: number } {
  const groups = new Map<
    string,
    { component: AssemblyComponent; quantity: number; ids: string[]; names: Set<string> }
  >();
  const configured = configuredPieces(parameters(pack), 'assembled');
  for (const { component } of configured) {
    const procurement = component.procurement;
    const specification =
      component.supply === 'manufactured'
        ? component.name
        : procurement?.designation || component.name;
    const key = JSON.stringify([
      component.supply,
      component.libraryId,
      specification,
      procurement?.manufacturer,
      procurement?.source,
      component.manufacturing?.material,
      component.manufacturing?.processes,
    ]);
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += component.quantity;
      existing.ids.push(component.id);
      existing.names.add(component.name);
    } else {
      groups.set(key, {
        component,
        quantity: component.quantity,
        ids: [component.id],
        names: new Set([component.name]),
      });
    }
  }
  const header = [
    'item',
    'quantity',
    'unit',
    'supply',
    'library_id',
    'specification',
    'description',
    'manufacturer',
    'source',
    'material',
    'processes',
    'component_ids',
    'notes',
  ];
  const rows = [...groups.values()].map(({ component, quantity, ids, names }, index) => {
    const manufacturing = component.manufacturing;
    const notes = [component.notes ?? '', ...(manufacturing?.requirements ?? [])];
    if (component.id === 'host-panel')
      notes.push('Host panel is a reference installation item, not a supplied kit component.');
    if (ids.some((id) => id.startsWith('cell-')))
      notes.push(
        'Reference protected button-top cell envelope; select and physically qualify delivered cells with the MPD holder.',
      );
    return [
      index + 1,
      quantity,
      'ea',
      component.supply,
      component.libraryId,
      component.supply === 'manufactured'
        ? component.name
        : component.procurement?.designation || component.name,
      [...names].sort().join(' / '),
      component.procurement?.manufacturer ?? '',
      component.procurement?.source ?? '',
      manufacturing?.material ?? '',
      manufacturing?.processes?.join(' / ') ?? '',
      ids.sort().join(' / '),
      notes.filter(Boolean).join(' '),
    ];
  });
  return {
    csv: [header, ...rows].map((row) => row.map(csv).join(',')).join('\n') + '\n',
    rows: rows.length,
    occurrences: configured.length,
  };
}

function inputs(pack: Pack): InputFile[] {
  const files: InputFile[] = [];
  for (const id of printedIds)
    for (const extension of ['stl', 'step']) {
      const name = `Module_${pack}_print_${id}.${extension}`;
      files.push({ source: `test-results/panel-battery-module/${name}`, path: `print/${name}` });
    }
  for (const name of [`Module_${pack}`, `Module_${pack}_print`])
    for (const extension of ['FCStd', 'step', 'FCMacro'])
      files.push({
        source: `test-results/panel-battery-module/${name}.${extension}`,
        path: `cad/${name}.${extension}`,
      });
  for (const name of templateNames)
    files.push({
      source: `test-results/panel-battery-module/${pack}/${name}`,
      path: `templates/${name}`,
    });
  files.push(
    { source: 'src/parts/panel-battery-module/GUIDE.md', path: 'GUIDE.md' },
    {
      source: 'test-results/panel-battery-module/validation.json',
      path: 'validation/native-roundtrip.json',
    },
    {
      source: 'test-results/panel-battery-module/templates-validation.json',
      path: 'validation/templates-validation.json',
    },
    {
      source: 'test-results/panel-battery-module/current-code-provenance.json',
      path: 'validation/current-code-provenance.json',
    },
    {
      source: `test-results/panel-battery-module/${slicerDirectory}/report.json`,
      path: 'validation/slicer-report.json',
    },
    {
      source: `test-results/panel-battery-module/${slicerDirectory}/provenance-check.json`,
      path: 'validation/slicer-provenance-check.json',
    },
    ...[
      'printer.json',
      'filament.json',
      'process.json',
      'controlled-overrides.json',
      ...additionalProfiles.map(({ file }) => file),
    ].map((name) => ({
      source: `test-results/panel-battery-module/${slicerDirectory}/${name}`,
      path: `slicer/${name}`,
    })),
  );
  files.push({
    source: 'src/parts/signal-connector/lib/xh254-evidence.json',
    path: 'validation/balance-header-evidence.json',
  });
  for (const { file } of additionalSlicerEvidence)
    files.push({
      source: `test-results/panel-battery-module/${slicerDirectory}/${file}`,
      path: `validation/slicer-${file}`,
    });
  return files;
}

if (args.includes('--plan')) {
  for (const pack of packs) {
    const bill = bom(pack);
    console.log(
      JSON.stringify(
        {
          pack,
          parameters: parameters(pack),
          inputFiles: inputs(pack),
          optionalSlicerProfiles:
            'Additional per-part profiles declared by the final slicer report',
          bomRows: bill.rows,
          occurrences: bill.occurrences,
        },
        null,
        2,
      ),
    );
  }
  process.exit(0);
}

const nativeBytes = await readFile(resolve(output, 'validation.json'));
const native = JSON.parse(nativeBytes.toString('utf8')) as { units: string; cases: NativeCase[] };
const prepared = await json<PreparedCase[]>('cases.json');
const templateValidation = await json<{
  allPassed: boolean;
  checks: {
    pack: string;
    drawing: string;
    passed: boolean;
    templateManifestSHA256: string;
    csvSHA256: string;
  }[];
}>('templates-validation.json');
const slicer = await json<{
  allPassed: boolean;
  nativeValidationReportSHA256: string;
  parts: SlicedPart[];
  slicer: string;
  additionalProfiles?: SlicerProfile[];
  baselineReport?: SlicerProfile;
  supportCoverageReport?: SlicerProfile;
  supportedTrialReport?: SlicerProfile;
}>(`${slicerDirectory}/report.json`);
additionalProfiles = slicer.additionalProfiles ?? [];
const profileNames = new Set([
  'printer.json',
  'filament.json',
  'process.json',
  'controlled-overrides.json',
]);
for (const profile of additionalProfiles) {
  fail(
    /^[a-z0-9][a-z0-9._-]*\.json$/i.test(profile.file) && !profileNames.has(profile.file),
    `Invalid or duplicate per-part slicer profile: ${profile.file}`,
  );
  profileNames.add(profile.file);
  fail(
    sha256(await readFile(resolve(output, slicerDirectory, profile.file))) === profile.sha256,
    `Per-part slicer profile changed after audit: ${profile.file}`,
  );
}
additionalSlicerEvidence = [
  slicer.baselineReport,
  slicer.supportCoverageReport,
  slicer.supportedTrialReport,
].filter((item): item is SlicerProfile => item !== undefined);
const evidenceNames = new Set<string>();
for (const evidence of additionalSlicerEvidence) {
  fail(
    /^[a-z0-9][a-z0-9._-]*\.json$/i.test(evidence.file) && !evidenceNames.has(evidence.file),
    `Invalid or duplicate supporting slicer report: ${evidence.file}`,
  );
  evidenceNames.add(evidence.file);
  fail(
    sha256(await readFile(resolve(output, slicerDirectory, evidence.file))) === evidence.sha256,
    `Supporting slicer evidence changed after audit: ${evidence.file}`,
  );
}
fail(native.units === 'mm', 'Native report units must be mm.');
const states = part.states;
fail(
  states && states.length > 0,
  'The module must define its inspection and manufacturing states.',
);
const expectedCases = packs.flatMap((pack) => [
  ...states.map(({ id: state }) => ({
    id:
      state === 'assembled'
        ? `Module_${pack}`
        : state === 'print-layout'
          ? `Module_${pack}_print`
          : `Module_${pack}_${state.replaceAll('-', '_')}`,
    state,
    pack,
  })),
  ...[1, 6].map((panelThickness) => ({
    id: `Module_${pack}_panel${panelThickness}`,
    state: 'assembled',
    pack,
  })),
]);
fail(
  prepared.length === expectedCases.length &&
    new Set(prepared.map((item) => item.id)).size === expectedCases.length,
  `Expected ${expectedCases.length} unique prepared native cases for the current module states.`,
);
for (const expected of expectedCases)
  fail(
    prepared.some(
      (item) =>
        item.id === expected.id &&
        item.state === expected.state &&
        item.parameters.pack === expected.pack,
    ),
    `Prepared case missing: ${expected.id}`,
  );
fail(
  native.cases.length === prepared.length,
  `Native refresh is incomplete; wait for all ${expectedCases.length} current cases.`,
);
for (const item of prepared) {
  const checked = native.cases.find((record) => record.id === item.id);
  fail(checked?.result === 'PASS', `Native case missing or failed: ${item.id}`);
  const codeHash = sha256(item.code);
  fail(checked.codeSHA256 === codeHash, `Native report is stale for ${item.id}.`);
  fail(
    sha256(part.python(item.parameters, item.state)) === codeHash,
    `Prepared native case differs from current generator: ${item.id}`,
  );
  if (item.wrapper) {
    fail(
      checked.export?.fcstd === `${item.id}.FCStd`,
      `Native FCStd round trip missing: ${item.id}`,
    );
    fail(
      checked.export?.step.file === `${item.id}.step`,
      `Native STEP round trip missing: ${item.id}`,
    );
    fail(
      (await readFile(resolve(output, `${item.id}.FCMacro`), 'utf8')) === item.wrapper,
      `Native macro differs from validated case: ${item.id}`,
    );
  }
}
fail(templateValidation.allPassed, 'Template validation failed.');
fail(slicer.allPassed, 'Slicer audit failed.');
const slicerUsesCurrentNativeReport = slicer.nativeValidationReportSHA256 === sha256(nativeBytes);
fail(
  slicerUsesCurrentNativeReport,
  'Slicer audit must reference the complete current native report; historical audits cannot qualify revised geometry.',
);
const expectedSlicedParts = packs.flatMap((pack) =>
  printedIds.map((id) => `Module_${pack}_print_${id}`),
);
fail(
  slicer.parts.length === expectedSlicedParts.length &&
    new Set(slicer.parts.map((item) => item.part)).size === expectedSlicedParts.length,
  `Expected ${expectedSlicedParts.length} unique current print-part slicer records.`,
);
for (const name of expectedSlicedParts)
  fail(
    slicer.parts.some((item) => item.part === name),
    `Slicer case missing: ${name}`,
  );
for (const pack of packs) {
  const p = parameters(pack);
  fail(part.validate(p, 'assembled').length === 0, `${pack} parameters are invalid.`);
  const sourceCase = prepared.find((item) => item.id === `Module_${pack}`)!;
  fail(
    JSON.stringify(sourceCase.parameters) === JSON.stringify(p),
    `${pack} exported parameters differ from delivery defaults.`,
  );
  const templateManifestBytes = await readFile(resolve(output, pack, 'templates.json'));
  const templates = JSON.parse(templateManifestBytes.toString('utf8')) as {
    pack: string;
    provenance: Record<string, string>;
    drawings: { id: string; svgSha256: string; dxfSha256: string }[];
  };
  fail(
    templates.pack === pack && templates.drawings.length === 2,
    `${pack} template manifest is incomplete.`,
  );
  for (const [path, hash] of Object.entries(templates.provenance))
    fail(sha256(await readFile(resolve(root, path))) === hash, `Template source changed: ${path}`);
  for (const drawing of templates.drawings) {
    const checked = templateValidation.checks.find(
      (check) => check.pack === pack && check.drawing === drawing.id && check.passed,
    );
    fail(checked, `${pack}/${drawing.id} template not validated.`);
    fail(
      checked.templateManifestSHA256 === sha256(templateManifestBytes),
      `${pack}/${drawing.id} template validation references an older manifest.`,
    );
    fail(
      checked.csvSHA256 ===
        sha256(await readFile(resolve(output, pack, `${drawing.id}-holes.csv`))),
      `${pack}/${drawing.id} drill-coordinate CSV changed after validation.`,
    );
    for (const extension of ['svg', 'dxf'] as const)
      fail(
        sha256(await readFile(resolve(output, pack, `${drawing.id}.${extension}`))) ===
          drawing[`${extension}Sha256`],
        `${pack}/${drawing.id}.${extension} changed after export.`,
      );
  }
  const printCase = native.cases.find((item) => item.id === `Module_${pack}_print`)!;
  fail(
    printCase.printParts.length === printedIds.length,
    `${pack} needs ${printedIds.length} audited print parts.`,
  );
  for (const id of printedIds) {
    const name = `Module_${pack}_print_${id}`;
    const audited = printCase.printParts.find((item) => item.id === id);
    fail(
      audited?.stl === `${name}.stl` && audited.step.file === `${name}.step`,
      `Native print export missing: ${name}`,
    );
    const sliced = slicer.parts.find((item) => item.part === name);
    fail(
      sliced?.passed && sliced.processExitCode === 0,
      `Slicer result missing or failed: ${name}`,
    );
    fail(
      sliced.nativeCodeSHA256 === printCase.codeSHA256,
      `Slicer native-code provenance stale: ${name}`,
    );
    fail(
      sliced.sourceSha256 === sha256(await readFile(resolve(output, `${name}.stl`))),
      `Slicer STL provenance stale: ${name}`,
    );
  }
  for (const file of inputs(pack))
    fail((await stat(resolve(root, file.source))).size > 0, `Empty input: ${file.source}`);
}
if (args.includes('--check')) {
  console.log(
    'Both delivery kits have current native, template and slicer evidence; no archives written.',
  );
  process.exit(0);
}

const zipProgram = String.raw`
import hashlib, json, os, sys, zipfile
from pathlib import Path
spec = json.loads(Path(sys.argv[1]).read_text())
root = Path(spec['stage'])
manifest_bytes = (root/'MANIFEST.json').read_bytes()
manifest = json.loads(manifest_bytes)
expected = {row['path']: row for row in manifest['files']}
prefix = spec['prefix']+'/'
destination = Path(spec['destination'])
temporary = destination.with_name(destination.name+'.tmp')
try:
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name in sorted([*expected, 'MANIFEST.json']):
            data = (root/name).read_bytes()
            info = zipfile.ZipInfo(prefix+name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(temporary) as archive:
        assert archive.testzip() is None, 'ZIP CRC failure'
        names = archive.namelist()
        assert len(names) == len(set(names)) == len(expected)+1, 'Unexpected/duplicate archive entries'
        assert set(names) == {prefix+name for name in [*expected, 'MANIFEST.json']}, 'Archive entry mismatch'
        assert not any(name.lower().endswith(('.gcode', '.gcode.3mf')) for name in names), 'Machine G-code is excluded'
        assert archive.read(prefix+'MANIFEST.json') == manifest_bytes, 'Manifest changed'
        for name, record in expected.items():
            data = archive.read(prefix+name)
            assert len(data) == record['bytes'], ('Archive size mismatch', name)
            assert hashlib.sha256(data).hexdigest() == record['sha256'], ('Archive hash mismatch', name)
    os.replace(temporary, destination)
    print(json.dumps({'archive': destination.name, 'entries': len(expected)+1, 'bytes': destination.stat().st_size, 'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'allEntryHashesVerified': True}))
finally:
    if temporary.exists(): temporary.unlink()
`;

const staging = await mkdtemp(resolve(tmpdir(), 'panel-battery-delivery-'));
try {
  for (const pack of packs) {
    const stage = resolve(staging, pack);
    await mkdir(stage, { recursive: true });
    const records: FileRecord[] = [];
    const put = async (path: string, bytes: Uint8Array | string, source: string) => {
      const data = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
      const destination = resolve(stage, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, data);
      records.push({ path, bytes: data.length, sha256: sha256(data), source });
    };
    for (const file of inputs(pack))
      await put(file.path, await readFile(resolve(root, file.source)), file.source);
    const bill = bom(pack);
    await put(
      'BOM.csv',
      bill.csv,
      'Live configuredPieces(parameters, assembled), aggregated by supply/library/specification',
    );
    await put(
      'slicer/README.md',
      '# Slicer reference profiles\n\nThese are the isolated factory-derived profiles used for the offline audit, with controlled overrides recorded separately. Apply any per-part process profiles and local support settings declared in the report and controlled overrides. They target the stated Bambu P1P 0.4 mm/PETG configuration; choose and qualify your own printer settings before printing. Individual STL files already have the tested Z orientation; move them in XY as needed without rotating them. No generated machine G-code is included. The audit report preserves original local evidence paths, which are not files supplied in this kit.\n',
      'Delivery-kit explanation',
    );
    const d = layout(parameters(pack));
    const sourceCase = native.cases.find((item) => item.id === `Module_${pack}`)!;
    const sourcePaths = [
      'scripts/package-panel-battery-module.ts',
      'scripts/verify-panel-battery-module.ts',
      'scripts/verify-panel-battery-module.py',
      'scripts/export-panel-battery-templates.ts',
      'scripts/bake-xh254-connectors.py',
      ...[
        'part.ts',
        'configurator.ts',
        'product.json',
        'presets.json',
        'lib/layout.ts',
        'lib/model.ts',
        'lib/hardware.ts',
        'lib/shapes.ts',
        'lib/ribbon.ts',
        'lib/closure.ts',
      ].map((path) => `src/parts/panel-battery-module/${path}`),
      `src/parts/li-ion-battery-holder/lib/native/${d.holder.id}.json`,
      'src/parts/electrical-connector/lib/panel.ts',
      'src/parts/electrical-connector/lib/models.json',
      `src/parts/signal-connector/lib/native/xh254-balance-header-ra-${d.headerPins}.json`,
      'src/parts/signal-connector/lib/model.ts',
      'src/parts/signal-connector/lib/catalog.json',
      'src/parts/signal-connector/lib/xh254-evidence.json',
      'src/parts/signal-connector/lib/xh254-mating.json',
      'src/parts/compression-spring/part.ts',
      'src/parts/compression-spring/configurator.ts',
      'src/core/hardware/spring-geometry.ts',
    ];
    const provenance = Object.fromEntries(
      await Promise.all(
        sourcePaths.map(async (path) => [path, sha256(await readFile(resolve(root, path)))]),
      ),
    );
    const manifest = {
      schema: 'protolab.panel-battery-delivery.v1',
      pack,
      units: 'mm',
      parameters: parameters(pack),
      archive: `Panel_battery_module_${pack}.zip`,
      contents: {
        printedParts: printedIds,
        individualSTL: printedIds.length,
        individualSTEP: printedIds.length,
        nativeDocuments: ['assembled', 'print-layout'],
        templateFiles: templateNames.length,
        bomRows: bill.rows,
        assembledOccurrences: bill.occurrences,
      },
      exportScope: {
        assembledFCStd:
          'Full reference assembly with source-library components and nominal purchased hardware',
        assembledSTEP: 'Manufactured components only, as recorded by the native export report',
        printFiles: `${printedIds.length} PETG occurrences in tested print orientations`,
        donorBoards:
          'Prepared FR4 envelopes; use critical drilling and edge-relief templates. Unused stock perforations and pads are omitted.',
        excluded: ['Generated machine G-code', 'Temporary diagnostics', 'FreeCAD backups'],
      },
      qualification: {
        holder: {
          designation: d.holder.designation,
          geometry: 'Unmodified original MPD manufacturer STEP',
          source: d.holder.source,
          sourceCAD: d.holder.sourceCadUrl,
          sourceSHA256: d.holder.sourceSha256,
        },
        balanceHeader: {
          designation: `White right-angle XH-style ${d.headerPins}-contact header, nominal 2.54 mm`,
          geometry:
            'Authored side-facing photo-based shroud and nominal bent pins, not original manufacturer CAD or an identified JST 2.50 mm part',
          deliveredPairQualified: false,
          mounting:
            'Soldered directly to the main board at X-50.5, centred at Y0; opening faces -X flush with the left shell',
          requirement:
            'Verify delivered pitch, bent-tail footprint, shroud, cable housing, guides and pin order. Release the M4 mounts and withdraw the complete module for side access, or remove cells for separate charging.',
        },
        lidAndSling:
          'Retract the recessed bolt 4 mm, tilt the lid 17 degrees and feed the unanchored soft loop through its central slot before withdrawing the two left under-rim hooks by 4 mm and lifting 35 mm. Pull cells only after the lid clears. The loop is not a locked-module carrying handle. Verify fabric handling physically.',
        latchSpring: {
          nominalMm: { outerDiameter: 8, freeLength: 10, wireDiameter: 0.4 },
          assumedCoils: { total: 6, active: 4, ends: 'closed, unground' },
          installedLengthMm: { locked: 9, released: 5 },
          conservativeReferenceSolidHeightMm: 2.8,
          travelMm: 4,
          returnForceRated: false,
          requirement:
            'Measure the delivered spring, preserve clearance from actual coil bind, and qualify free return against printed PETG friction. Printed shoulders limit travel; no force or cycle-life rating is assigned.',
        },
        purchasedCellFit: {
          qualified: false,
          referenceCellMm: { length: d.cellLength, diameter: d.cellDiameter },
          sourceRequirement:
            'Protected button-top 18650, 65–68 mm length; verify delivered diameter, wrapper and elastic retention physically',
          knownSourceRetentionEngagement: sourceCase.sourceRetentionEngagement,
          limitation:
            'Native PASS establishes enclosure and service-path checks. It does not qualify the rigid reference-cell overlap with supplier retention clips as a purchased-cell fit.',
        },
        electrical:
          'Independent holder contacts require authored insulated series links and balance wiring; no BMS, fuse, charging circuit or current rating is established.',
        printing:
          'Offline slicer and CAD checks are recorded; physical PETG/insert/hardware and cell-retention tests remain required.',
      },
      evidence: {
        nativeReportSHA256: sha256(nativeBytes),
        nativeCases: native.cases
          .filter((item) => item.id.startsWith(`Module_${pack}`))
          .map(({ id, state, codeSHA256, result }) => ({ id, state, codeSHA256, result })),
        slicer: slicer.slicer,
        additionalSlicerProfiles: additionalProfiles,
        additionalSlicerEvidence,
        slicerAuditNativeReportSHA256: slicer.nativeValidationReportSHA256,
        slicerUsesCurrentNativeReport,
        slicerInputsVerified: `All ${printedIds.length} current native print-code hashes and actual STL byte hashes match the corresponding slicer inputs.`,
        templateScale: '1:1 millimetres; print at 100% and measure the 50 mm calibration line',
      },
      sourceSHA256: provenance,
      fileHashScope:
        'Every included payload file is listed below. MANIFEST.json is excluded from its own hash list; the archive validator checks its exact bytes separately.',
      files: records.sort((a, b) => a.path.localeCompare(b.path)),
    };
    await writeFile(resolve(stage, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
    const spec = resolve(staging, `zip-${pack}.json`);
    await writeFile(
      spec,
      JSON.stringify({
        stage,
        prefix: `Panel_battery_module_${pack}`,
        destination: resolve(output, `Panel_battery_module_${pack}.zip`),
      }),
    );
    const zipped = spawnSync(process.env.PYTHON ?? 'python3', ['-c', zipProgram, spec], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (zipped.error) throw zipped.error;
    fail(zipped.status === 0, `ZIP packaging/validation failed: ${zipped.stderr || zipped.stdout}`);
    console.log(zipped.stdout.trim());
  }
} finally {
  await rm(staging, { recursive: true, force: true });
}
