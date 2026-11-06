/** Prepare repeatable physical-unit CAD and Ethernet-access checks. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3, type Group } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { cylinder, pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import type { ConfiguredPiece } from '../src/core/assembly/detail-instances';
import type { AssemblyComponent } from '../src/core/product-types';
import type { Parameters, PartDefinition, Preset } from '../src/core/types';

interface PayloadModule {
  default: PartDefinition;
  libraries: PartDefinition[];
  configuredPieces(parameters: Parameters, state: string): ConfiguredPiece[];
  serviceKeepout(parameters: Parameters): { shape: Shape; componentIds: string[] };
  shoulderFit(parameters: Parameters): { shape: Shape; componentIds: string[] };
  csiRoutingReserve(parameters: Parameters): Shape;
  csiCablePlan(parameters: Parameters): {
    freePathLength: number;
    availableLength: number;
    insertionAllowance: number;
    totalLength: number;
    slack: number;
    minBendRadius: number;
    edgePathLengths: [number, number];
    longestEdgeLength: number;
    centerlineWithEnds: number;
  };
  layout(parameters: Parameters): { extraction: number };
  structuralCoordinates: {
    piX: number;
    piZ: number;
    adapterX: number;
    ssdX: number;
    upsX: number;
    upsZ: number;
  };
  printingRotations: Record<string, [number, number, number]>;
  equipmentFastenerMounts(
    parameters: Parameters,
    coords: PayloadModule['structuralCoordinates'],
  ): { id: string; removeForTrayService: boolean }[];
}

// The verifier is a CLI consumer, not part of the application package graph.
const payload = (await import(
  new URL('../src/parts/rocket-camera-nose/part.ts', import.meta.url).href
)) as PayloadModule;
const output = resolve(process.argv[2] ?? 'test-results/rocket-camera-nose');
const requestedPresets = process.argv[3]?.split(',');
mkdirSync(output, { recursive: true });
const byId = new Map(parts.map((part) => [part.id, part]));
const standaloneIds = [
  'optical-dome-window',
  'board-camera-19',
  'waveshare-ups-3s',
  'waveshare-pcie-m2-d',
  'm2-ssd',
  'raspberry-pi',
  'li-ion-cell',
  'gps-tracker',
  'jhe42b-finder',
];
const allCases: Record<string, unknown>[] = [];

function metrics(model: Group) {
  model.updateMatrixWorld(true);
  const box = new Box3().setFromObject(model, true);
  assert.ok(!box.isEmpty(), 'Physical model cannot be empty.');
  let volume = 0;
  let meshCount = 0;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    meshCount++;
    const positions = object.geometry.getAttribute('position');
    const indices = object.geometry.index;
    assert.ok(Array.from(positions.array).every(Number.isFinite), 'Finite physical mesh data.');
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map((offset) =>
        new Vector3()
          .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset)
          .applyMatrix4(object.matrixWorld),
      );
      volume += vertices[0].dot(vertices[1].cross(vertices[2])) / 6;
    }
  });
  assert.ok(meshCount > 0 && Number.isFinite(volume) && volume > 0, 'Positive mesh volume.');
  return { min: box.min.toArray(), max: box.max.toArray(), volume, meshCount };
}

function identity(component: AssemblyComponent) {
  return {
    id: component.id,
    libraryId: component.libraryId,
    parameters: component.parameters,
    state: component.state,
    quantity: component.quantity,
    supply: component.supply,
    manufacturing: component.manufacturing,
    procurement: component.procurement,
  };
}

function validateComponent(component: AssemblyComponent) {
  const definition = byId.get(component.libraryId);
  assert.ok(definition, 'Unresolved physical library ID: ' + component.libraryId);
  assert.deepEqual(
    validateParameters(definition, component.parameters, component.state),
    [],
    'Invalid physical library configuration: ' + component.id,
  );
  assert.equal(component.quantity, 1, 'Use individual physical occurrences for native checks.');
  return definition;
}

async function prepareStandalone(part: PartDefinition, presets: readonly Preset[] = part.presets) {
  const state = part.states?.[0]?.id ?? 'default';
  for (const preset of presets) {
    const parameters = { ...part.defaults, ...preset.parameters };
    assert.deepEqual(validateParameters(part, parameters, state), [], part.id + '/' + preset.id);
    await part.initializeGeometry?.(parameters, state);
    const model = (part.buildExportGeometry ?? part.buildGeometry)(parameters, state);
    try {
      const measured = metrics(model);
      const name = part.id + '--' + preset.id + '--' + state;
      const declaredDimensions = (part.exportDimensions ?? part.dimensions)(parameters, state);
      const macro = generateScript(
        { ...part, exportDimensions: () => declaredDimensions },
        parameters,
        state,
      );
      writeFileSync(resolve(output, name + '.FCMacro'), macro);
      allCases.push({
        name,
        kind: 'standalone',
        id: part.id,
        presetId: preset.id,
        parameters,
        state,
        macroFile: name + '.FCMacro',
        macroSHA256: createHash('sha256').update(macro).digest('hex'),
        declaredDimensions,
        ...measured,
        manufactured: part.product.supply === 'manufactured',
      });
    } finally {
      disposeModel(model);
    }
  }
}

for (const id of standaloneIds) {
  const part = byId.get(id);
  assert.ok(part, 'Missing standalone library package: ' + id);
  if (id === 'raspberry-pi' || id === 'li-ion-cell') {
    const model = id === 'raspberry-pi' ? 'raspberry-pi-5' : 'molicel-p28a';
    const selected = part.presets.find(
      (preset) =>
        preset.parameters.model === model &&
        (id !== 'raspberry-pi' || preset.parameters.detail === 'lightweight'),
    );
    assert.ok(selected, 'Missing selected reference model: ' + model);
    await prepareStandalone(part, [selected]);
  } else await prepareStandalone(part);
}

const assembly = payload.default;
assert.equal(assembly.id, 'rocket-camera-nose');
assert.ok(assembly.composition, 'The manufactured assembly must declare its physical structure.');
const presets = assembly.presets.filter(
  (preset) => !requestedPresets || requestedPresets.includes(preset.id),
);
assert.ok(presets.length, 'No matching assembly preset.');
const states = ['assembled', 'cutaway', 'extracted'];
for (const preset of presets) {
  const parameters = { ...assembly.defaults, ...preset.parameters };
  const canonical = assembly.composition(parameters);
  const canonicalIdentities = canonical.components.map(identity);
  assert.equal(
    new Set(canonical.components.map((component) => component.id)).size,
    canonical.components.length,
  );
  for (const component of canonical.components) validateComponent(component);
  const canonicalById = new Map(canonical.components.map((component) => [component.id, component]));
  for (const state of states) {
    await assembly.initializeGeometry?.(parameters, state);
    assert.deepEqual(validateParameters(assembly, parameters, state), [], preset.id + '/' + state);
    assert.deepEqual(
      assembly.composition(parameters).components.map(identity),
      canonicalIdentities,
      'Inspection state must preserve the physical bill of materials.',
    );
    const inspectionPieces = payload
      .configuredPieces(parameters, state)
      .filter((piece) => piece.component.supply !== 'reference');
    assert.equal(
      inspectionPieces.length,
      canonical.components.length,
      'Physical occurrences must survive every inspection state.',
    );
    for (const piece of inspectionPieces) {
      const known = canonicalById.get(piece.component.id);
      assert.ok(known, 'Unregistered assembly occurrence: ' + piece.component.id);
      assert.deepEqual(
        identity(piece.component),
        identity(known),
        'Inspection pose must preserve configuration identity.',
      );
      validateComponent(piece.component);
    }
    // The separated housing is an inspection overlay; cutaway CAD stays assembled.
    const physicalState = state === 'cutaway' ? 'assembled' : state;
    const pieces = payload
      .configuredPieces(parameters, physicalState)
      .filter((piece) => piece.component.supply !== 'reference');
    const model = (assembly.buildExportGeometry ?? assembly.buildGeometry)(parameters, state);
    try {
      assert.equal(
        model.children.length,
        pieces.length,
        'Physical unit and preview group counts differ.',
      );
      const components = pieces.map((piece, index) => ({
        ...identity(piece.component),
        label: piece.label,
        placement: piece.component.placement,
        pose: { position: piece.position ?? [0, 0, piece.z ?? 0], angle: piece.angle ?? 0 },
        ...metrics(model.children[index] as Group),
      }));
      const measured = metrics(model);
      const name = assembly.id + '--' + preset.id + '--' + state;
      const declaredDimensions = (assembly.exportDimensions ?? assembly.dimensions)(
        parameters,
        state,
      );
      const macro = generateScript(
        { ...assembly, exportDimensions: () => declaredDimensions },
        parameters,
        state,
      );
      writeFileSync(resolve(output, name + '.FCMacro'), macro);
      const keepouts = [];
      const containment = [];
      if (parameters.packaging === 'structural-ogive') {
        const cable = payload.csiCablePlan(parameters);
        assert.ok(
          cable.totalLength <= cable.availableLength,
          'The 100 mm CSI lead must cover the path and end allowances.',
        );
        // Full objective radius, with a 110-degree air-space cone. Glass is the
        // transmitting surface and needs its own optical/refraction qualification.
        const opticalZ = Number(parameters.noseLength) + 2;
        const opticalCone: Shape = {
          kind: 'revolve',
          segments: 64,
          profile: [
            [0, opticalZ],
            [6, opticalZ],
            [6 + 8 * Math.tan((55 * Math.PI) / 180), opticalZ + 8],
            [0, opticalZ + 8],
          ],
        };
        keepouts.push({
          id: 'camera-110deg-housing-clearance',
          shapeCode: pythonShape(
            state === 'extracted'
              ? {
                  kind: 'transform',
                  child: opticalCone,
                  rotation: [0, 0, 0],
                  translation: [0, 0, -payload.layout(parameters).extraction],
                }
              : opticalCone,
          ),
          componentIds: components
            .filter((component) => component.id !== 'optical-window')
            .map((component) => component.id),
        });
        const route = payload.csiRoutingReserve(parameters);
        keepouts.push({
          id: 'csi-100mm-ribbon-route',
          shapeCode: pythonShape(
            state === 'extracted'
              ? {
                  kind: 'transform',
                  child: route,
                  rotation: [0, 0, 0],
                  translation: [0, 0, -payload.layout(parameters).extraction],
                }
              : route,
          ),
          componentIds: components.map((component) => component.id),
        });
      }
      if (state === 'extracted') {
        const keepout = payload.serviceKeepout(parameters);
        assert.ok(
          keepout.componentIds.length,
          'Ethernet access requires explicit cassette targets.',
        );
        assert.equal(new Set(keepout.componentIds).size, keepout.componentIds.length);
        for (const id of keepout.componentIds)
          assert.ok(canonicalById.has(id), 'Unknown Ethernet keepout target: ' + id);
        if (['tpu-compact', 'structural-ogive'].includes(String(parameters.packaging))) {
          for (const piece of pieces) {
            const moved = (piece.position ?? [0, 0, piece.z ?? 0]).some((value) => value !== 0);
            if (moved && piece.component.libraryId !== 'raspberry-pi')
              assert.ok(
                keepout.componentIds.includes(piece.component.id),
                'Ethernet access must include moving camera/equipment: ' + piece.component.id,
              );
          }
        }
        keepouts.push({
          id: 'ethernet-service-access',
          shapeCode: pythonShape(keepout.shape),
          componentIds: keepout.componentIds,
        });
      }
      if (state === 'assembled') {
        const fit = payload.shoulderFit(parameters);
        assert.ok(fit.componentIds.length, 'Shoulder fit requires explicit cassette targets.');
        for (const id of fit.componentIds)
          assert.ok(canonicalById.has(id), 'Unknown shoulder-fit target: ' + id);
        containment.push({
          id: 'shoulder-internal-cylinder',
          shapeCode: pythonShape(fit.shape),
          componentIds: fit.componentIds,
        });
        const tubeBottom =
          Math.min(
            -Number(parameters.shoulderLength),
            ...components.map((component) => component.min[2]),
          ) - 1;
        containment.push({
          id: 'actual-mating-tube-negative-section',
          shapeCode: pythonShape(
            cylinder(Number(parameters.tubeID) / 2, -tubeBottom, [0, 0, tubeBottom]),
          ),
          // Installed tube bolts cross its wall. They are fitted only after the insert is seated.
          // All inserting print bodies, cradles, captive nuts and equipment remain checked.
          componentIds: components
            .filter((component) => !component.id.startsWith('body-anchor-screw-'))
            .map((component) => component.id),
        });
      }
      allCases.push({
        name,
        kind: 'assembly',
        id: assembly.id,
        presetId: preset.id,
        parameters,
        state,
        physicalState,
        macroFile: name + '.FCMacro',
        macroSHA256: createHash('sha256').update(macro).digest('hex'),
        declaredDimensions,
        components,
        keepouts,
        containment,
        ...(parameters.packaging === 'structural-ogive'
          ? {
              printedRotations: payload.printingRotations,
              trayServiceRemovedIds: [
                'rear-cable-grommet',
                ...payload
                  .equipmentFastenerMounts(parameters, payload.structuralCoordinates)
                  .filter((mount) => mount.removeForTrayService)
                  .map((mount) => mount.id),
              ],
              requiredContacts: [
                ...(physicalState === 'assembled'
                  ? [
                      {
                        first: 'load-frame',
                        second: 'window-retainer',
                        z: Number(parameters.noseLength) - 8.8,
                        minimumArea: 190,
                      },
                    ]
                  : []),
                {
                  first: 'window-retainer',
                  second: 'window-rear-gasket',
                  z: Number(parameters.noseLength) - 0.8,
                  minimumArea: 190,
                },
                {
                  first: 'window-rear-gasket',
                  second: 'optical-window',
                  z: Number(parameters.noseLength),
                  minimumArea: 190,
                },
                {
                  first: 'optical-window',
                  second: 'window-front-gasket',
                  z: Number(parameters.noseLength) + 1,
                  minimumArea: 170,
                },
                {
                  first: 'window-front-gasket',
                  second: 'nose-shell',
                  z: Number(parameters.noseLength) + 1.4,
                  minimumArea: 170,
                },
              ],
              windowDogCheck: state === 'assembled',
              csiCablePlan: (() => {
                const c = payload.csiCablePlan(parameters);
                return {
                  availableLength: c.availableLength,
                  freePathLength: c.freePathLength,
                  insertionAllowance: c.insertionAllowance,
                  totalLength: c.totalLength,
                  slack: c.slack,
                  minBendRadius: c.minBendRadius,
                  edgePathLengths: c.edgePathLengths,
                  longestEdgeLength: c.longestEdgeLength,
                  centerlineWithEnds: c.centerlineWithEnds,
                  scope:
                    'Geometric routing budget; actual FFC developability, twist, connector insertion and camera pinout require delivered-part verification.',
                };
              })(),
            }
          : {}),
        ...measured,
      });
      console.log('Prepared ' + name + ': ' + components.length + ' physical units.');
    } finally {
      disposeModel(model);
    }
  }
}

writeFileSync(
  resolve(output, 'cases.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      units: 'mm',
      coordinateSystem:
        'Z toward the nose; component placements and inspection poses are explicit.',
      standaloneIds,
      states,
      limits: { overlapVolume: 1e-4, envelope: 0.06 },
      cases: allCases,
    },
    null,
    2,
  ) + '\n',
);
console.log('Prepared ' + allCases.length + ' complete macros in ' + output + '.');
