/** Prepare source-bound native CAD and separately oriented print exports. */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { validateParameters } from '../src/core/validation';
import part from '../src/parts/field-daq-enclosure/part';
import { configuredPieces, libraries, pieces } from '../src/parts/field-daq-enclosure/lib/model';
import { layout } from '../src/parts/field-daq-enclosure/lib/layout';
import { retentionNativeInput } from './field-daq-retention-input';

const output = resolve(process.argv[2] ?? 'test-results/field-daq-enclosure');
const parameters = {
  ...part.defaults,
  showReferences: false,
  ...(process.argv[3] === 'wide' ? { bodyWidth: 164, sensorCount: '4' } : {}),
};
const errors = validateParameters(part, parameters, 'assembled');
if (errors.length) throw new Error(errors.join('; '));
mkdirSync(output, { recursive: true });

const sha = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
const assembly = configuredPieces(parameters, 'assembled');
const inspection = configuredPieces({ ...parameters, showReferences: true }, 'assembled');
const originals = pieces(parameters);
const print = configuredPieces(parameters, 'print-layout').map((piece, i) => {
  const original = originals.find((candidate) => candidate.id === piece.component.id);
  if (!original || original.reference) throw new Error('Printable component metadata is missing.');
  return {
    id: piece.component.id,
    label: piece.label,
    material: original.material,
    name: `FieldDAQ-${String(i + 1).padStart(2, '0')}-${piece.component.id}-${original.material}.stl`,
    code: componentPython(libraries, [piece]),
  };
});

for (const sensorCount of (Number(parameters.bodyWidth) >= 164
  ? ['2', '3', '4', 'blank']
  : ['2', '3', 'blank']
).filter((count) => count !== parameters.sensorCount)) {
  const p = { ...parameters, sensorCount };
  const printPiece = configuredPieces(p, 'panel')[0];
  print.push({
    id: `panel-${sensorCount}`,
    label: `Alternative sensor cassette / ${sensorCount === 'blank' ? 'blank' : `${sensorCount} SP20`}`,
    material: 'PETG',
    name: `FieldDAQ-panel-${sensorCount === 'blank' ? 'blank' : `${sensorCount}sp20`}-PETG.stl`,
    code: componentPython(libraries, [printPiece]),
  });
}
print.push({
  id: 'fit-coupon',
  label: 'PCB, connector-aperture and side-loaded nut-trap fit coupon',
  material: 'PETG',
  name: 'FieldDAQ-fit-coupon-PETG.stl',
  code: part.python(parameters, 'fit-coupon'),
});
print.push({
  id: 'retention-coupon',
  label: 'Central PCB groove and production-bridge test base / not an assembly occurrence',
  material: 'PETG',
  name: 'FieldDAQ-retention-coupon-PETG.stl',
  code: part.python(parameters, 'retention-coupon'),
});

const code = part.python(parameters, 'assembled');
const sourceFiles = [
  'src/core/pcb-retention.ts',
  'src/core/pcb-retention-bridge.ts',
  'src/parts/field-daq-enclosure/lib/model.ts',
  'src/parts/field-daq-enclosure/lib/layout.ts',
  'src/parts/field-daq-enclosure/lib/closure.ts',
  'src/parts/field-daq-enclosure/lib/board-retention.ts',
  'src/parts/field-daq-enclosure/part.ts',
  'src/parts/field-daq-enclosure/configurator.ts',
  'src/parts/waterproof-connector/lib/model.ts',
  'src/parts/waterproof-connector/lib/catalog.ts',
  'src/parts/waterproof-connector/part.ts',
  'src/parts/waterproof-connector/configurator.ts',
  'src/parts/washer/part.ts',
  'scripts/export-field-daq-enclosure.ts',
  'scripts/export-field-daq-enclosure.py',
  'scripts/field-daq-retention-input.ts',
  'scripts/field-daq-retention-checks.py',
];
const record = {
  version: 3,
  revision: 'R3',
  releaseStatus:
    'Fit-check prototype; physical rain, wet-ground, snow-melt and impact tests required',
  partId: part.id,
  output,
  unit: 'mm',
  parameters,
  retentionAudit: retentionNativeInput(parameters),
  layout: layout(parameters),
  code,
  codeSha256: sha(code),
  sourceHashes: Object.fromEntries(sourceFiles.map((path) => [path, sha(readFileSync(path))])),
  components: assembly.map((piece) => ({
    id: piece.component.id,
    label: piece.label,
    color: piece.color,
    supply: piece.component.supply,
    material: piece.component.manufacturing?.material ?? 'metal hardware',
  })),
  audit: {
    code: componentPython(libraries, inspection),
    ids: inspection.map((piece) => piece.component.id),
    records: inspection.map((piece) => ({
      id: piece.component.id,
      label: piece.label,
      color: piece.color,
      supply: piece.component.supply,
      libraryId: piece.component.libraryId,
      model: piece.component.parameters.model,
      material:
        piece.component.manufacturing?.material ??
        (piece.component.supply === 'reference' ? 'Reference' : 'metal hardware'),
    })),
    connectors: inspection
      .filter((piece) => piece.component.libraryId === 'waterproof-connector')
      .map((piece) => ({
        id: piece.component.id,
        label: piece.label,
        placement: piece.component.placement,
        appearanceCode: libraries
          .find((lib) => lib.id === piece.component.libraryId)!
          .python(piece.component.parameters, piece.component.state),
      })),
  },
  connectorLibraryAudit:
    Number(parameters.bodyWidth) === 116
      ? libraries
          .find((lib) => lib.id === 'waterproof-connector')!
          .presets.flatMap((preset) =>
            ['assembled', 'exploded'].map((state) => ({
              id: preset.id,
              state,
              code: libraries
                .find((lib) => lib.id === 'waterproof-connector')!
                .python(preset.parameters, state),
            })),
          )
      : [],
  print,
};

writeFileSync(resolve(output, 'native-input.json'), JSON.stringify(record, null, 2) + '\n');
copyFileSync('src/parts/field-daq-enclosure/GUIDE.md', resolve(output, 'GUIDE.md'));
writeFileSync(
  resolve(output, 'REVISION.txt'),
  [
    'FIELD DAQ ENCLOSURE — REVISION 3 (R3)',
    'Fit-check prototype. No IP or impact qualification has been established.',
    'R3 replaces the earlier enclosure files. Do not print withdrawn earlier files or mix their parts with this revision.',
    'Side-loaded M3 nut traps have a base-owned 3 mm bearing roof.',
    'A removable central bridge now forms positive grooves over both inner PCB edges; no lid or pad friction is needed for retention.',
    'Install the boards first. Hold the leaf 0.9 mm lifted while dropping the bridge at its entry and sliding +Y3 mm, then release the leaf into its catch.',
    'Service: remove lid; lift the leaf 0.9 mm with a nail or 2.5 mm Allen key; slide bridge -Y3 mm and lift; then withdraw a PCB inward 9.5 mm.',
    'The lid rear post positively blocks the reverse bridge stroke as a backup to the leaf.',
    'TRIZ method: segmentation, local quality, preliminary action, dynamics and intermediary. https://triz.org/principles/',
    'The roof-captured nut closure, steel washer seats, cassette stops, glands and source connector identities are retained.',
    'Add four M3 steel flat washers, 3.2 x 7 x 0.5 mm (ISO 7089 / DIN 125).',
    'The steel washers seat on PETG hard annuli; under-washer TPU seals provide sealing without carrying the structural preload after seating.',
    'Under-washer seals: free OD4.84 / ID2.8 x 0.8 mm, 0.1 mm radial interference on M3; nominal installed-volume fill approximately 84.3%.',
    'Print the 34 x 104 mm retention coupon first and test the production bridge and broad open triangular inner-corner pockets with bare PCB strips; the coupon is not an assembly part.',
    'The other coupon nut trap checks side insertion, roof capture and thread start only. Its blind tip well is not an M3 x 30 full-tightening fixture.',
    'Enclosure BOM: 16 printed occurrences + 4 screws + 4 nuts + 4 steel washers = 28 physical occurrences.',
    'Target exposure: wet ground, dirt, rain, snow and meltwater. Print and physically qualify these exposures and cold handling before installing electronics.',
    `Assembly source SHA256: ${record.codeSha256}`,
    '',
  ].join('\n'),
);
writeFileSync(
  resolve(output, 'BOM.csv'),
  [
    'item,quantity,material,description',
    ...originals
      .filter((piece) => !piece.reference)
      .map((piece) => `${piece.id},1,${piece.material},"${piece.label.replaceAll('"', '""')}"`),
    `closure-screw,4,metal,M3 x ${parameters.screwLength} socket cap screw ISO 4762; verify actual stock`,
    'closure-nut,4,metal,M3 hex nut 5.5 AF x 2.4 mm ISO 4032; verify actual stock',
    'closure-steel-washer,4,steel,M3 flat washer 3.2 x 7 x 0.5 mm ISO 7089 / DIN 125; required in R3',
  ].join('\n') + '\n',
);
writeFileSync(
  resolve(output, 'FieldDAQ-source.FCMacro'),
  [
    '# Field DAQ R3 / fit-check prototype. Millimetres; reference boards and connectors omitted.',
    'import FreeCAD as App',
    'import Part',
    'import math',
    'doc = App.newDocument("FieldDAQ")',
    'doc.Label = "Field DAQ R3 / fit-check prototype"',
    code,
    `labels = ${JSON.stringify(record.components.map((piece) => piece.label))}`,
    `ids = ${JSON.stringify(record.components.map((piece) => piece.id))}`,
    `colors = ${JSON.stringify(record.components.map((piece) => [((piece.color >> 16) & 255) / 255, ((piece.color >> 8) & 255) / 255, (piece.color & 255) / 255]))}`,
    'for index, component in enumerate(components):',
    '    obj = doc.addObject("Part::Feature", "DAQ_%02d" % (index+1))',
    '    obj.Label = ids[index] + " | " + labels[index]',
    '    obj.Shape = component',
    '    if App.GuiUp: obj.ViewObject.ShapeColor = tuple(colors[index])',
    'doc.recompute()',
    'if App.GuiUp:',
    '    import FreeCADGui as Gui',
    '    Gui.activeDocument().activeView().viewAxonometric()',
    '    Gui.activeDocument().activeView().fitAll()',
    '',
  ].join('\n'),
);
console.log(
  JSON.stringify({
    output,
    input: resolve(output, 'native-input.json'),
    printedFiles: print.length,
    assemblyComponents: assembly.length,
  }),
);
