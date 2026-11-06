/** Exact native export/audit recipes for the passive core, solid discs and curved cover. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { python } from '../src/core/assembly/boundary/assembly';
import { cylinder, type Shape } from '../src/core/assembly/boundary/shapes';
import { validateParameters } from '../src/core/validation';
import {
  grandadoPieces,
  grandadoSpec,
  grandadoBodyMeasurements,
  grandadoRaisedRim,
  grandadoRimSpec,
} from '../src/parts/catalog-enclosure/lib/grandado';
import part from '../src/parts/grandado-tube-mount/part';
import {
  printedPieces,
  fitCoupon,
  payload,
  cellReferences,
  hardware,
  tubeReference,
  referenceTubeBounds,
  factoryLidScrews,
  libraries,
  occurrence,
  cableReference,
} from '../src/parts/grandado-tube-mount/lib/model';
import { layout, move, connectorReliefs, antennaRelief } from '../src/parts/grandado-tube-mount/lib/spec';
import { jigPieces, jigLayout } from '../src/parts/grandado-tube-mount/lib/jig';
import {
  cassetteContactSpec,
  cassetteAllowances,
} from '../src/parts/grandado-tube-mount/lib/cassette';
import { endRetainerSpec } from '../src/parts/grandado-tube-mount/lib/end-retainer';
import {
  cableRoutingSpec,
  cableAssemblySpec,
  cableWireReference,
  cableRouteEnvelope,
  cableClosingReliefs,
  cassetteCableReliefs,
  bodyLoadingCableRelief,
  discCableReliefs,
} from '../src/parts/grandado-tube-mount/lib/cable-routing';
import {
  replacementLidSpec,
  replacementLidPieces,
  replacementLidGroove,
  replacementLidGasketReference,
} from '../src/parts/grandado-tube-mount/lib/replacement-lid';

const output = resolve(process.argv[2] ?? 'test-results/grandado-tube-mount');
const parameters = { ...part.defaults };
assert.deepEqual(validateParameters(part, parameters, 'assembled'), []);
const d = layout(parameters),
  contacts = cassetteContactSpec(parameters),
  disc = endRetainerSpec(parameters),
  lid = replacementLidSpec(parameters);
assert.equal(d.boxTop - d.radius, 1);
assert.equal(Number(parameters.holderLength), 77.7);
assert.equal(Number(parameters.holderWidth), 59.69);
assert.equal(Number(parameters.holderHeight), 21.54);
assert.equal(contacts.serviceOvertravel, 0);
const installed = printedPieces(parameters),
  print = [...installed, fitCoupon(parameters)];
assert.equal(new Set(print.map((piece) => piece.id)).size, print.length);
const ids = new Set(installed.map((piece) => piece.id));
for (const id of [
  contacts.upperHalfId,
  ...contacts.lowerHalfIds,
  contacts.keeperId,
  'end-disc-negative',
  'end-disc-positive',
  'grandado-curved-replacement-lid',
])
  assert.ok(ids.has(id), `Missing current detail ${id}`);
for (const id of ids)
  assert.ok(
    !/outer-saddle|upper-spacer|grandado-cradle|lower-nut-carrier|battery-holder-tray|cell-keeper-(minus|plus)|end-retainer-/.test(
      id,
    ),
    `Obsolete detail ${id}`,
  );
const shapeCode = (shape: Shape, label: string) => python([{ shape, label, color: 0x999999 }]);
const piecesCode = (shapes: Shape[], label: string) =>
  python(shapes.map((shape, i) => ({ shape, label: `${label} ${i + 1}`, color: 0xcc9966 })));
const existingPayload = payload(parameters),
  hardwareItems = hardware(parameters),
  cells = cellReferences(parameters);
const leadAssembly = cableAssemblySpec(parameters);
const wireShape = cableWireReference(parameters);
assert.equal(wireShape.kind, 'union');
const wirePrimitives = wireShape.kind === 'union' ? wireShape.children : [];
assert.equal(wirePrimitives.length, 2 * leadAssembly.finalCenterline.length - 1);
const [entryStart, entryEnd] = [leadAssembly.bodyEntryLeadStart, leadAssembly.bodyEntryLeadEnd];
assert.equal(entryStart[0], entryEnd[0]);
assert.equal(entryStart[2], entryEnd[2]);
const bodyEntryLead: Shape = {
  kind: 'union', nativeBatch: true,
  children: [
    cylinder(leadAssembly.wireRadius, entryStart[1] - entryEnd[1], entryEnd, 'y'),
    { kind: 'sphere', radius: leadAssembly.wireRadius, origin: entryStart },
    { kind: 'sphere', radius: leadAssembly.wireRadius, origin: entryEnd },
  ],
};
assert.equal(existingPayload[0].component.libraryId, 'catalog-enclosure');
assert.equal(existingPayload[0].component.parameters.model, 'grandado-83-58-35-clear');
assert.equal(existingPayload[0].component.state, 'body-only');
assert.equal(existingPayload[1].component.libraryId, 'li-ion-battery-holder');
assert.equal(existingPayload[1].component.parameters.model, 'beilamoo-3s');
const factoryScrews = factoryLidScrews(parameters);
assert.equal(factoryScrews.length, 4);
assert.ok(factoryScrews.every((piece) => piece.component.supply === 'manufactured'));
assert.ok(!existingPayload.some((piece) => piece.component.libraryId === 'adhesive-antenna'));

assert.equal(cells.length, 3);
assert.ok(cells.every((cell) => cell.component.libraryId === 'li-ion-cell'));
assert.equal(hardwareItems.length, 16);
assert.equal(hardwareItems.filter((piece) => piece.component.id.endsWith('-screw')).length, 8);
assert.equal(hardwareItems.filter((piece) => piece.component.id.endsWith('-nut')).length, 8);
const screws = hardwareItems.filter((piece) => piece.component.id.endsWith('-screw'));
assert.equal(screws.filter((piece) => piece.component.parameters.length === 12).length, 8);
assert.equal(print.length, 19, 'Eighteen printed kit pieces plus the fit coupon are required.');
const sources = [
  ...readdirSync(resolve('src/parts/grandado-tube-mount/lib'))
    .filter((path) => path.endsWith('.ts'))
    .map((path) => `src/parts/grandado-tube-mount/lib/${path}`),
  'src/parts/grandado-tube-mount/part.ts',
  'src/parts/grandado-tube-mount/configurator.ts',
  'src/core/assembly/boundary/assembly.ts',
  'src/core/assembly/boundary/shapes.ts',
  'src/core/component-recipes.ts',
  'src/parts/catalog-enclosure/part.ts',
  'src/parts/catalog-enclosure/lib/grandado.ts',
  'src/parts/catalog-enclosure/lib/grandado-rim.ts',
  'src/parts/li-ion-battery-holder/lib/models.json',
  'src/parts/li-ion-battery-holder/lib/native/beilamoo-3s.json',
  'src/parts/li-ion-cell/lib/model.ts',
  'src/parts/li-ion-cell/lib/models.json',
  'scripts/verify-grandado-tube-mount.ts',
  'scripts/verify-grandado-tube-mount.py',
];
const printable = (piece: (typeof print)[number], coupon = false) => ({
  id: piece.id,
  label: piece.label,
  nativeRefine: piece.nativeRefine !== false,
  role: coupon ? 'coupon' : piece.role,
  color: piece.color,
  python: componentPython(libraries, [occurrence(piece, true)]),
  installedPython: componentPython(libraries, [occurrence(piece)]),
});
const record = {
  version: 12,
  revision: 'measured-body-ear-capture-and-attached-lead-axial-closure',
  partId: part.id,
  parameters,
  layout: d,
  referenceTubeBounds: referenceTubeBounds(parameters),
  sourceHashes: Object.fromEntries(
    sources.map((path) => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]),
  ),
  nominalSourceLimits: [
    'The83×58×35 envelope and4 mm callouts are published. The user physically confirmed the replacement lid hole pattern. Ear pitch99 mm, remaining molded features and factory screw/insert dimensions remain photograph-based reconstruction assumptions.',
    'The BeiLaMoo holder uses a source-dimension reconstruction. Undeformed plastic-rib and spring intersections with maximum-diameter cells are measured separately; physical fit is not established by this audit.',
    'Cell support-pad localZ1.6 mm is measured from source CAD; flat floor1.4 mm. Cell center=support+radius is derived, not a factory cavity-axis specification.',
    'Nominal bore contact patches use exact R43 tangency. Actual sliding fit, bolt engagement, FDM strength, preload and impact qualification require the physical parts.',
    'Delivered-sample dimensions are hardbody22 mm, bodyincludingrim23.8 mm, raisedrim1.8 mm andears6 mm. The source library implements those measurements and an approximately uniform1 mm rim wall, outer78.7×53.7 mm; reportedinner76.8×51.6 mm contains measurement uncertainty. Corner profile, precise wall/centring tolerance, deeper cavity and2 mm supporting ledge remain reconstruction assumptions. The lid retains1.8 mm side/post channels andapproximately2 mm depth, withnominal0.2 mm rigid-rim headroom. Its default0.5 mm total X fit allowance moves only the inner end flanks0.25 mm inward, makingtheendchannels2.05 mm wide. Actual physical contact is unidentified; this is an authored fitting trial, not a proven cause or physical closure claim. Channel space includes the entering source rim and is not rubber or a sealing qualification.',
    'The inwardØ19 power connector centre is user measured12 mm above the external bodybottom. Its actual occupied envelope, without an invented extra outside lid service layer, must clear the unchanged lid and sealing channel.',
    'The Grandado lead is connected before cassette closure. Continuous native clearance certificates cover the authored fixed final lead against actual moving closure groups. This is a geometric anti-pinch check, not a cable-material bend, strain, harness length or physical impact qualification.',
  ],
  chordArc: {
    projectedWidthMm: d.windowWidth,
    surfaceArcMm: 2 * d.radius * Math.asin(d.windowWidth / d.od),
  },
  printed: print.map((piece) => printable(piece, piece.id === 'fit-coupon')),
  nominalJig: jigPieces({ ...parameters, windowClearance: 0 }).map((piece) => printable(piece)),
  coverAuditCases: [
    [89, 0],
    [89, 0.6],
    [90, 0],
    [92, 0],
    [92, 0.6],
  ].map(([tubeOD, windowClearance]) => {
    const p = { ...parameters, tubeOD, windowClearance };
    const piece = replacementLidPieces(p)[0];
    return {
      tubeOD,
      windowClearance,
      spec: replacementLidSpec(p),
      python: componentPython(libraries, [occurrence(piece)]),
    };
  }),
  audit: {
    tubeStock: shapeCode(tubeReference(parameters, 'template'), 'Uncut source tube'),
    tubeWindow: shapeCode(
      tubeReference(parameters, 'assembled'),
      'Window, eight radial countersinks and optional cable-entry bore',
    ),
    grandado: componentPython(libraries, [existingPayload[0], ...factoryScrews]),
    grandadoBodyOnly: componentPython(libraries, existingPayload.slice(0, 1)),
    grandadoSourceSpec: grandadoSpec,
    grandadoBodyMeasurements,
    grandadoRimSpec,
    grandadoRaisedRim: shapeCode(
      move(grandadoRaisedRim(), [0, 0, d.boxTranslation]),
      'Delivered-height Grandado raised sealing rim',
    ),
    factoryLidScrews: componentPython(libraries, factoryScrews),
    originalFactoryScrews: piecesCode(
      grandadoPieces('assembled')
        .slice(6)
        .map((piece) => piece.shape),
      'Unmodified source factory lid screws',
    ),
    holder: componentPython(libraries, existingPayload.slice(1, 2)),
    lidGroove: componentPython(libraries, [
      occurrence({
        id: 'lid-gasket-groove-audit',
        label: 'One continuous lid-side gasket groove cutter',
        shape: replacementLidGroove(parameters),
        printShape: replacementLidGroove(parameters),
        color: 0x999999,
        role: 'cassette',
        nativeRefine: false,
      }),
    ]),
    lidChannelSpace: componentPython(libraries, [
      occurrence({
        id: 'lid-channel-space-audit',
        label: 'Measured lid channel space · inspection only',
        shape: replacementLidGasketReference(parameters),
        printShape: replacementLidGasketReference(parameters),
        color: 0x999999,
        role: 'cassette',
        nativeRefine: false,
      }),
    ]),

    cells: cells.map((cell) => ({
      id: cell.component.id,
      label: cell.label,
      python: componentPython(libraries, [cell]),
      placement: cell.component.placement,
    })),
    cellNominalToleranceDiameter: 18.3,
    hardware: componentPython(libraries, hardwareItems),
    hardwareRecords: hardwareItems.map((piece) => ({
      id: piece.component.id,
      label: piece.label,
      libraryId: piece.component.libraryId,
      parameters: piece.component.parameters,
      placement: piece.component.placement,
    })),
    cassetteContacts: contacts,
    cassetteAllowances,
    discSpec: disc,
    lidSpec: lid,
    jigSpec: jigLayout(parameters),
    upperId: contacts.upperHalfId,
    lowerIds: contacts.lowerHalfIds,
    keeperId: contacts.keeperId,
    discIds: ['end-disc-negative', 'end-disc-positive'],
    lidId: 'grandado-curved-replacement-lid',
    connectorReliefs: piecesCode(connectorReliefs(d), 'Connector service allowance'),
    connectorOccupied: piecesCode(
      connectorReliefs({ ...d, connectorClearance: 0 }),
      'Connector occupied envelope',
    ),
    inwardPowerConnector: shapeCode(
      cylinder(d.powerDiameter / 2, d.powerDepth, [0, -d.boxWidth / 2, d.powerCenterZ], 'y'),
      'Actual inward power connector at measured body-bottom + 12 mm centre',
    ),
    cableEntryRelief: piecesCode(antennaRelief(d), 'Optional lower cable-entry clearance'),
    cableRouting: {
      spec: cableRoutingSpec(parameters),
      assemblySpec: leadAssembly,
      wire: componentPython(libraries, [cableReference(parameters)]),
      wirePrimitiveEnvelope: piecesCode(wirePrimitives, 'Exact attached lead analytic primitive'),
      bodyEntryLead: shapeCode(bodyEntryLead, 'Straight attached Grandado lead during body loading'),
      bodyLoadingRelief: shapeCode(bodyLoadingCableRelief(parameters), 'Upper-only body loading and local key notch'),
      closingCuts: shapeCode(cableClosingReliefs(parameters), 'Axial entries for the fixed attached lead'),
      allCassetteCuts: piecesCode(cassetteCableReliefs(parameters), 'Complete cassette wire reliefs'),
      clearance: componentPython(libraries, [
        occurrence({
          id: 'cable-clearance-audit',
          label: 'Connected cable service corridor',
          shape: cableRouteEnvelope(parameters),
          printShape: cableRouteEnvelope(parameters),
          color: 0x888888,
          role: 'cassette',
          nativeRefine: false,
        }),
      ]),
      discCuts: piecesCode(discCableReliefs(parameters), 'Both full-depth disc U grooves'),
    },
    libraryPayloadIds: existingPayload.map((piece) => piece.component.libraryId),
    assemblyOrder: [
      'Place loaded keeper vertically over holder outside cage',
      'Slide the two lower halves around the loaded holder/keeper from opposite ends',
      'Lift Grandado with already attached straight outward lead through the upper loading notch frombelow',
      'With lower assembly and discs still separate, lay the free lead into its final route and negative axial entries',
      'Slide loaded lower into upper T guides from+X over the fixed already attached final lead',
      'Install both loaded solid discs on bench while the routed lead remains fixed',
      'Slide body/core/discs/captive nuts axially into tube at final height',
      'Install all eight radial M3x12 screws',
      'Install the smooth curved cover and four source factory screws after the specified2mm tip trim',
    ],
  },
};
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'native-input.json'), JSON.stringify(record, null, 2) + '\n');
console.log(
  JSON.stringify({
    fixture: resolve(output, 'native-input.json'),
    revision: record.revision,
    printedParts: print.length,
    nominalJigParts: record.nominalJig.length,
    hardware: hardwareItems.length,
    chordArc: record.chordArc,
  }),
);
