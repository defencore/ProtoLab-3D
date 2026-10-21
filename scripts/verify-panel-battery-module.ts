/** Prepare production assembly cases and standalone native export macros. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import part from '../src/parts/panel-battery-module/part';
import {
  configuredPieces,
  pieces,
  latchShape,
  lidPoseShape,
  hostOpening,
} from '../src/parts/panel-battery-module/lib/model';
import { latch } from '../src/parts/panel-battery-module/lib/closure';
import {
  hardware,
  libraries as hardwareLibraries,
} from '../src/parts/panel-battery-module/lib/hardware';
import { componentPython } from '../src/core/assembly/detail-instances';
import { python as shapePython } from '../src/core/assembly/boundary/assembly';
import type { Shape } from '../src/core/assembly/boundary/shapes';
import { layout } from '../src/parts/panel-battery-module/lib/layout';
import { ribbonRoute } from '../src/parts/panel-battery-module/lib/ribbon';
import holder from '../src/parts/li-ion-battery-holder/part';
import matingAssets from '../src/parts/signal-connector/lib/xh254-mating.json';
import { supplierPython, type SupplierAsset } from '../src/core/manufacturer-cad';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { Parameters } from '../src/core/types';

const output = resolve(process.argv[2] ?? 'test-results/panel-battery-module');
mkdirSync(output, { recursive: true });
const planned = ['3S', '4S'].flatMap((pack) => [
  { id: `Module_${pack}`, pack, state: 'assembled', export: true },
  ...[1, 6].map((panelThickness) => ({
    id: `Module_${pack}_panel${panelThickness}`,
    pack,
    state: 'assembled',
    panelThickness,
  })),
  { id: `Module_${pack}_unlocked`, pack, state: 'unlocked' },
  { id: `Module_${pack}_open`, pack, state: 'open' },
  { id: `Module_${pack}_exploded`, pack, state: 'exploded' },
  { id: `Module_${pack}_print`, pack, state: 'print-layout', export: true },
  { id: `Module_${pack}_panel_template`, pack, state: 'panel-template' },
]);
function closureFixture(parameters: Parameters) {
  const entries: {
    id: string;
    role: 'slider' | 'lid' | 'installation';
    partId: string;
    travel?: number;
    angle?: number;
    withdraw?: number;
    lift?: number;
    deltaZ?: number;
    shape: Shape;
  }[] = [];
  for (const travel of [-0.25, ...Array.from({ length: 17 }, (_, i) => i / 4), 4.25])
    entries.push({
      id: `slider-${travel}`,
      role: 'slider',
      partId: 'latch-slider',
      travel,
      shape: latchShape(parameters, travel),
    });
  for (let deltaZ = -20; deltaZ <= 0; deltaZ += 0.5)
    entries.push({
      id: `rear-slider-${deltaZ}`,
      role: 'installation',
      partId: 'latch-slider',
      deltaZ,
      shape: {
        kind: 'transform',
        child: latchShape(parameters, 0),
        rotation: [0, 0, 0],
        translation: [0, 0, deltaZ],
      },
    });
  const lidParts = pieces(parameters).filter(
    (piece) => piece.id === 'lid' || piece.id.startsWith('lid-foam'),
  );
  const poses = [
    ...Array.from({ length: 18 }, (_, i) => ({ angle: -i, withdraw: 0, lift: 0 })),
    ...Array.from({ length: 16 }, (_, i) => ({ angle: -17, withdraw: (i + 1) / 4, lift: 0 })),
    ...[0.1, 0.3, 0.5, 1, 2, 5, 10, 20, 35].map((lift) => ({ angle: -17, withdraw: 4, lift })),
  ];
  for (const [i, pose] of poses.entries())
    for (const piece of lidParts)
      entries.push({
        id: `lid-${i}-${piece.id}`,
        role: 'lid',
        partId: piece.id,
        ...pose,
        shape: lidPoseShape(parameters, piece.shape, pose.angle, pose.withdraw, pose.lift),
      });
  const springPoses = [
    ...[-10, -5, 0].map((x) => ({ phase: 'loading', travel: -1, x })),
    ...[4, 2, 0].map((travel) => ({ phase: 'release', travel, x: 0 })),
  ];
  const springPieces = springPoses.map((pose) => ({
    ...hardware(parameters, pose.travel).find((piece) => piece.component.id === 'latch-spring')!,
    position: [pose.x, 0, 0] as [number, number, number],
  }));
  return {
    constants: latch,
    springPoses,
    springCode: componentPython(hardwareLibraries, springPieces),
    entries: entries.map(({ shape: _shape, ...metadata }) => metadata),
    code: shapePython(
      entries.map((entry) => ({ shape: entry.shape, label: entry.id, color: 0x888888 })),
    ),
  };
}

const cases = planned.map((item) => {
  const parameters: Parameters = {
    ...part.defaults,
    pack: item.pack,
    ...('panelThickness' in item ? { panelThickness: item.panelThickness } : {}),
  };
  const errors = validateParameters(part, parameters, item.state);
  if (errors.length) throw new Error(`${item.id}: ${errors.join(' ')}`);
  const wrapper =
    'export' in item && item.export ? generateScript(part, parameters, item.state) : undefined;
  if (wrapper) writeFileSync(resolve(output, `${item.id}.FCMacro`), wrapper);
  const mate = matingAssets.find(
    (asset) => asset.headerId === `xh254-balance-header-ra-${layout(parameters).headerPins}`,
  )!;
  const assembledPieces = configuredPieces(parameters, 'assembled').map((piece) => piece.component);
  return {
    id: item.id,
    parameters,
    state: item.state,
    layout: layout(parameters),
    printIds: pieces(parameters)
      .filter((piece) => piece.supply === 'manufactured' && piece.process !== 'drilling')
      .map((piece) => piece.id),
    holderCode: holder.python({ model: layout(parameters).holder.id }, 'assembled'),
    ribbonRoute: ribbonRoute(parameters),
    closureFixture: closureFixture(parameters),
    panelPassageCode: shapePython([
      {
        shape: hostOpening(parameters, -100, 200),
        label: 'Continuous host-panel passage',
        color: 0x888888,
      },
    ]),
    matingFixture: {
      id: mate.id,
      placement: assembledPieces.find((piece) => piece.id === 'balance-socket')!.placement,
      fullyMatedTranslation: mate.fullyMatedTranslation,
      approachTravel: Math.max(
        mate.approachTravel,
        Math.ceil(
          -50.5 + mate.fullyMatedTranslation[0] + mate.bounds[3] - layout(parameters).bodyLeft + 1,
        ),
      ),
      insertionAxis: mate.insertionAxis,
      outwardAxis: [-1, 0, 0],
      interfaceOrigin: [-2.5, 0, 2.9],
      contactTip: [-7.7, 0, 2.9],
      context: 'Module withdrawn from host panel; M4 panel mounting hardware removed',
      rowSpan: (layout(parameters).headerPins - 1) * 2.54,
      limitations: mate.limitations,
      code: supplierPython({ mate: mate as unknown as SupplierAsset }, [
        { key: 'mate', label: mate.designation, translation: [0, 0, 0] },
      ]),
    },
    code: part.python(parameters, item.state),
    assembledCode: part.python(parameters, 'assembled'),
    unlockedCode: part.python(parameters, 'unlocked'),
    openCode: part.python(parameters, 'open'),
    assembledPieces,
    pieces: configuredPieces(parameters, item.state).map((piece) => piece.component),
    wrapper,
  };
});
writeFileSync(resolve(output, 'cases.json'), JSON.stringify(cases, null, 2) + '\n');
console.log(`Prepared ${cases.length} native cases and four standalone macros in ${output}`);
