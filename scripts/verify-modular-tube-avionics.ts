import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { python as nativePython } from '../src/core/assembly/boundary/assembly';
import { roundedRect } from '../src/core/assembly/boundary/shapes';
import { componentPython } from '../src/core/assembly/detail-instances';
import { validateParameters } from '../src/core/validation';
import part from '../src/parts/modular-tube-avionics/part';
import {
  allPrinted,
  libraries,
  payload,
  composition,
  cableRouteReferences,
  powerCellReferences,
  holderFittingReferences,
} from '../src/parts/modular-tube-avionics/lib/model';
import {
  holeStations,
  serviceWindow,
  tubeShape,
  tubeMounting,
} from '../src/parts/modular-tube-avionics/lib/service';
import {
  datums,
  printed,
  tubeReferenceDatums,
} from '../src/parts/modular-tube-avionics/lib/shared';
import { coverDatums } from '../src/parts/modular-tube-avionics/lib/lower-cover';
import { lowerCoverPartIds, radioReferences } from '../src/parts/modular-tube-avionics/lib/radio';
import {
  auxiliaryContactSpecs,
  cameraContactSpecs,
  cameraSupportEngineering,
  noseDatums,
  piContactSpecs,
} from '../src/parts/modular-tube-avionics/lib/nose';
import { powerCellFit, powerContactSpecs } from '../src/parts/modular-tube-avionics/lib/power';
import { cassetteDatums } from '../src/parts/modular-tube-avionics/lib/flight-cassette';
import { holderUnitObservation } from '../src/parts/modular-tube-avionics/lib/holder-fit';

const output = resolve(process.argv[2] ?? 'test-results/modular-tube-avionics');
mkdirSync(output, { recursive: true });
const p = { ...part.defaults };
for (const preset of part.presets)
  for (const state of part.states!)
    assert.deepEqual(validateParameters(part, preset.parameters, state.id), []);
const print = allPrinted(p);
assert.equal(new Set(print.map((item) => item.id)).size, print.length);
const physical = composition(p);
const alternateCamera = payload({ ...p, cameraSetup: 'camera-19' }).find(
  (item) => item.component.id === 'nose-camera',
)!;
assert.equal(new Set(physical.components.map((item) => item.id)).size, physical.components.length);
for (const item of payload(p)) {
  const library = libraries.find((candidate) => candidate.id === item.component.libraryId)!;
  assert.deepEqual(
    validateParameters(library, item.component.parameters, item.component.state),
    [],
    item.component.id,
  );
  if (item.component.presetId)
    assert.ok(library.presets.some((preset) => preset.id === item.component.presetId));
}
const fixture = {
  parameters: p,
  coverDatums,
  tubeMounting,
  serviceWindow,
  lowerCoverWindow: {
    id: 'lower-cover-rounded-window',
    python: nativePython([
      {
        shape: roundedRect(
          serviceWindow.length,
          serviceWindow.width,
          serviceWindow.cornerRadius,
          -120,
          200,
        ),
        label: 'Actual rounded lower-window projection',
        color: 0x777777,
      },
    ]),
  },
  tube: {
    id: 'tube-reference',
    python: nativePython([
      { shape: tubeShape(false), label: 'Tube with top and bottom access only', color: 0x777777 },
    ]),
  },
  lowerCoverPartIds,
  cameraContacts: cameraContactSpecs(p),
  piContacts: piContactSpecs(),
  auxiliaryContacts: auxiliaryContactSpecs(),
  powerCellFit,
  powerContacts: powerContactSpecs(p),
  flightContacts: cassetteDatums.axes.map((_, index) => {
    const sleeveRadius =
      cassetteDatums.sleeveOuterDiameter / 2 + cassetteDatums.sleeveRadialClearance;
    const interference =
      cassetteDatums.deckBottom +
      cassetteDatums.deckThickness +
      cassetteDatums.upperLipHeight -
      cassetteDatums.padBottom -
      cassetteDatums.sleeveLength;
    const expectedVolume =
      interference * Math.PI * (cassetteDatums.eyeLipRadius ** 2 - sleeveRadius ** 2);
    return {
      ids: ['flight-board-isolator', `flight-cassette-washer-${index + 1}`],
      expectedVolume,
      maximumVolume: expectedVolume + 0.02,
      interference,
    };
  }),
  cameraSupportEngineering,
  cableRoutes: cableRouteReferences().map((item) => ({
    id: item.component.id,
    component: item.component,
    python: componentPython(libraries, [item]),
  })),
  references: radioReferences(p).map((item) => ({
    id: item.component.id,
    component: item.component,
    python: componentPython(libraries, [item]),
  })),
  cellReferences: powerCellReferences().map((item) => ({
    id: item.component.id,
    component: item.component,
    python: componentPython(libraries, [item]),
  })),
  holderFitting: {
    observations: holderUnitObservation,
    gauges: holderFittingReferences().map((item) => ({
      id: item.component.id,
      component: item.component,
      python: componentPython(libraries, [item]),
    })),
  },
  issues: physical.issues,
  printed: print.map((item) => ({
    ...item,
    shape: undefined,
    printShape: undefined,
    component: printed(item).component,
    manufacturingPython: item.printShape
      ? nativePython([{ shape: item.printShape, label: item.id, color: 0xaaaaaa }]) +
        '\nshape = shape.removeSplitter()'
      : undefined,
    python:
      nativePython([{ shape: item.shape, label: item.id, color: 0xaaaaaa }]) +
      '\nshape = shape.removeSplitter()',
  })),
  payload: payload(p).map((item) => ({
    id: item.component.id,
    libraryId: item.component.libraryId,
    component: item.component,
    catalog: libraries
      .find((library) => library.id === item.component.libraryId)
      ?.presets.find((preset) => preset.id === item.component.presetId)?.catalog,
    python: componentPython(libraries, [item]),
  })),
  alternate: allPrinted({ ...p, cameraSetup: 'camera-19' })
    .filter((item) => item.module === 'nose')
    .map((item) => ({
      ...item,
      shape: undefined,
      printShape: undefined,
      manufacturingPython: item.printShape
        ? nativePython([{ shape: item.printShape, label: item.id, color: 0xaaaaaa }]) +
          '\nshape = shape.removeSplitter()'
        : undefined,
      python:
        nativePython([{ shape: item.shape, label: item.id, color: 0xaaaaaa }]) +
        '\nshape = shape.removeSplitter()',
    })),
  alternateCamera: {
    id: alternateCamera.component.id,
    component: alternateCamera.component,
    python: componentPython(libraries, [alternateCamera]),
  },
  fittingCoupons: [0.2, 0.6].map((keyClearance) => {
    const item = allPrinted({ ...p, keyClearance }).find(
      (detail) => detail.id === 'square-key-fit-coupon',
    )!;
    return {
      id: `fit-coupon-${keyClearance}`,
      keyClearance,
      python: nativePython([{ shape: item.shape, label: item.id, color: 0xaaaaaa }]),
    };
  }),
};
writeFileSync(resolve(output, 'native-input.json'), JSON.stringify(fixture));
writeFileSync(resolve(output, 'composition.json'), JSON.stringify(physical, null, 2) + '\n');

// Full-circumference, true-scale paper marking sheet. X=0 is the Grandado centre.
const radius = tubeReferenceDatums.outerDiameter / 2,
  circumference = 2 * Math.PI * radius,
  offsetX = 10 - datums.nose.root,
  tubeLength = datums.tail.back - datums.nose.root,
  paperWidth = tubeLength + 20;
// The cut has circular corners in projected XY. Its cylindrical unwrap is not
// a rounded rectangle: sample the analytic arcs independently of CAD geometry.
const corner = serviceWindow.cornerRadius;
const halfX = serviceWindow.length / 2 - corner;
const halfY = serviceWindow.width / 2 - corner;
const outline = [
  [halfX, halfY, 0],
  [-halfX, halfY, 90],
  [-halfX, -halfY, 180],
  [halfX, -halfY, 270],
].flatMap(([x, y, start]) =>
  Array.from({ length: 33 }, (_, i) => {
    const angle = ((start + (i * 90) / 32) * Math.PI) / 180;
    return [x + corner * Math.cos(angle), y + corner * Math.sin(angle)];
  }),
);
const windowOutline = (centerS: number, bottom = false) => {
  const points = outline.map(([x, y]) => [
    x + offsetX,
    centerS + (bottom ? -1 : 1) * radius * Math.asin(y / radius),
  ]);
  return `<path d="M${points.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join('L')}Z" fill="none" stroke="#d12f27" stroke-width="0.3"/>`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${paperWidth}mm" height="${circumference + 40}mm" viewBox="0 -12 ${paperWidth} ${circumference + 40}">
<rect x="10" y="0" width="${tubeLength}" height="${circumference}" fill="white" stroke="black" stroke-width="0.2"/>
<defs><clipPath id="wrap-body"><rect x="10" y="0" width="${tubeLength}" height="${circumference}"/></clipPath></defs>
<g font-family="sans-serif" font-size="3"><text x="8" y="-7">Ø90/86 tube · actual size 100% · X=0 Grandado centre · +X aft</text><text x="8" y="-2">Top datum at wrap seam. Remove electronics before cutting. Pilot only; qualify countersink depth.</text>
<g clip-path="url(#wrap-body)">${windowOutline(0)}${windowOutline(circumference)}${windowOutline(circumference / 2, true)}</g>
${holeStations.flatMap((x) => [circumference / 4, (3 * circumference) / 4].map((y) => `<circle cx="${x + offsetX}" cy="${y}" r="1.5" fill="none" stroke="black" stroke-width="0.2"/><circle cx="${x + offsetX}" cy="${y}" r="${(x === noseDatums.shellAnchorX ? tubeMounting.shellHeadDiameter : tubeMounting.anchorHeadDiameter) / 2}" fill="none" stroke="#3d6694" stroke-width="0.2" stroke-dasharray="1,1"/><path d="M${x + offsetX - 3},${y}h6m-3,-3v6" stroke="black" stroke-width="0.2"/><text x="${x + offsetX + 2}" y="${y - 4}">X${x}</text>`)).join('')}
<path d="M10,${circumference + 5}h100m-100,-2v4m100,-4v4" stroke="black" stroke-width="0.3"/><text x="40" y="${circumference + 9}">100 mm calibration</text>
<text x="10" y="${circumference + 15}">Pilot 3 mm; finish Ø3.4. Anchors: 90° countersink Ø6.4 + 0.3 mm rim recess. X${noseDatums.shellAnchorX}: Ø6.2 head seat, radial Y±44.5.</text>
<text x="10" y="${circumference + 21}">Red: cut outline with projected R${corner} corners. Follow the wrapped curve; finish and deburr. Keep corner relief drilling inside the waste.</text></g></svg>`;
writeFileSync(resolve(output, 'tube-marking-wrap-1to1.svg'), svg);
for (let column = 0; column < 3; column++)
  for (let row = 0; row < 2; row++) {
    const tile = svg.replace(
      /width="[^"]+mm" height="[^"]+" viewBox="[^"]+"/,
      `width="180mm" height="180mm" viewBox="${column * 150} ${row * 150 - 12} 180 180"`,
    );
    writeFileSync(resolve(output, `tube-wrap-tile-${column + 1}-${row + 1}.svg`), tile);
  }
console.log(
  JSON.stringify({
    fixture: resolve(output, 'native-input.json'),
    printed: print.length,
    payload: fixture.payload.length,
    states: part.states!.length,
  }),
);
