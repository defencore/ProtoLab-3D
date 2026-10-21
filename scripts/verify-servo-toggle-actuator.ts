/** Prepare mounted servo/toggle cases for the isolated native assembly audit. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/servo-toggle-actuator/part';
import { configured } from '../src/parts/servo-toggle-actuator/lib/model';
import panelSwitch from '../src/parts/panel-switch/part';
import { pieces as switchPieces, sac01Cover } from '../src/parts/panel-switch/lib/model';
import { pythonShape } from '../src/core/assembly/mechanical/shapes';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import { disposeModel } from '../src/core/mechanical';
import type { Parameters } from '../src/core/types';

const defaults = (mechanism: 'rocker' | 'guided' | 'parallel' | 'parallel-dual'): Parameters => ({
  ...part.defaults,
  mechanism,
  ...(mechanism === 'guided'
    ? {
        baseLength: 160,
        baseWidth: 96,
        deckHeight: 50,
        contactHeight: 10,
        padGap: 13,
        servoSweep: 50,
      }
    : mechanism === 'parallel-dual'
      ? { baseLength: 100, baseWidth: 150, deckHeight: 42, manualState: 'guarded-off' }
      : mechanism === 'parallel'
        ? { baseLength: 80, baseWidth: 110, deckHeight: 42 }
        : { baseLength: 100, baseWidth: 90, deckHeight: 42 }),
});
const planned: { name: string; parameters: Parameters; state: string }[] = [
  ...(['rocker', 'guided', 'parallel'] as const).flatMap((mechanism) => [
    ...['off', 'press-on', 'on', 'press-off'].map((phase) => ({
      name: `${mechanism}-${phase}`,
      parameters: { ...defaults(mechanism), phase },
      state: 'assembled',
    })),
    {
      name: `${mechanism}-separated`,
      parameters: defaults(mechanism),
      state: 'exploded',
    },
  ]),
  {
    name: 'rocker-larger-base',
    parameters: { ...defaults('rocker'), baseLength: 120, baseWidth: 110, deckHeight: 50 },
    state: 'assembled',
  },
  {
    name: 'parallel-larger-base',
    parameters: { ...defaults('parallel'), baseLength: 90, baseWidth: 130 },
    state: 'assembled',
  },
  ...['off', 'press-on', 'on', 'press-off'].map((phase) => ({
    name: `parallel-dual-${phase}`,
    parameters: { ...defaults('parallel-dual'), phase },
    state: 'assembled',
  })),
  { name: 'parallel-dual-separated', parameters: defaults('parallel-dual'), state: 'exploded' },
  {
    name: 'parallel-dual-open-off',
    parameters: { ...defaults('parallel-dual'), manualState: 'open-off' },
    state: 'assembled',
  },
  {
    name: 'parallel-dual-open-on-large',
    parameters: {
      ...defaults('parallel-dual'),
      baseLength: 110,
      baseWidth: 160,
      manualState: 'open-on',
    },
    state: 'assembled',
  },
  ...part.presets.map((preset) => ({
    name: preset.id,
    parameters: preset.parameters,
    state: 'assembled',
  })),
];
const seen = new Set<string>();
const cases = planned
  .filter((item) => {
    const key = JSON.stringify([
      item.state,
      Object.keys(item.parameters)
        .sort()
        .map((k) => [k, item.parameters[k]]),
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })
  .map((item) => {
    const errors = validateParameters(part, item.parameters, item.state);
    if (errors.length) throw new Error(item.name + ': ' + errors.join('; '));
    const physical = part.composition!(item.parameters),
      pieces = configured(item.parameters, item.state);
    const expectedManufactured =
      item.parameters.mechanism === 'guided'
        ? 27
        : item.parameters.mechanism === 'parallel-dual'
          ? 7
          : item.parameters.mechanism === 'parallel'
            ? 6
            : 3;
    if (
      physical.components.filter((c) => c.supply === 'manufactured').length !== expectedManufactured
    )
      throw new Error(
        `${item.name}: wrong manufactured component count for ${item.parameters.mechanism}.`,
      );
    const isDual = item.parameters.mechanism === 'parallel-dual';
    const model = part.buildGeometry(item.parameters, item.state);
    try {
      model.updateMatrixWorld(true);
      if (model.children.length !== pieces.length)
        throw new Error('Configured/preview component count differs.');
      const components = model.children.map((child, index) => {
        const bounds = new Box3().setFromObject(child, true),
          source = pieces[index].component;
        let volume = 0,
          meshes = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          meshes++;
          const position = mesh.geometry.getAttribute('position'),
            indices = mesh.geometry.index;
          for (let i = 0; i < (indices?.count ?? position.count); i += 3) {
            const [a, b, c] = [0, 1, 2].map((j) =>
              new Vector3()
                .fromBufferAttribute(position, indices ? indices.getX(i + j) : i + j)
                .applyMatrix4(mesh.matrixWorld),
            );
            volume += a.dot(b.clone().cross(c)) / 6;
          }
        });
        return {
          id: source.id,
          label: child.name,
          libraryId: source.libraryId,
          supply: source.supply,
          manufacturing: source.manufacturing,
          parameters: source.parameters,
          state: source.state,
          placement: source.placement,
          min: bounds.min.toArray(),
          max: bounds.max.toArray(),
          volume,
          // Every fabricated recipe is one solid. Purchased units retain their native leaves.
          sourceSolids: source.supply === 'purchased' ? meshes : 1,
          requireSingleSolid: source.supply === 'manufactured',
          retainedSupplier: source.libraryId === 'bus-servo',
        };
      });
      return {
        name: `${part.id}/${item.name}/${item.state}`,
        id: part.id,
        state: item.state,
        parameters: item.parameters,
        mechanism: item.parameters.mechanism,
        expectedManufactured,
        compositionLibraryIds: physical.components.map((c) => c.libraryId),
        compositionIds: physical.components.map((c) => c.id),
        components,
        // Independent installation fixtures are audit tools, never physical BOM occurrences.
        ...(['parallel', 'parallel-dual'].includes(String(item.parameters.mechanism)) &&
        item.state === 'assembled'
          ? {
              installationFixtures: {
                hostPlate: {
                  size: [
                    Number(item.parameters.baseLength) + 20,
                    Number(item.parameters.baseWidth) + 20,
                  ],
                  centre: [0, isDual ? -47 : -27],
                  top: 0,
                  thicknesses: [1, 3, 6],
                  opening: {
                    size: [56, isDual ? 124 : 84],
                    centre: [0, isDual ? -48 : -28],
                    radius: 4,
                  },
                  sideBranch: { size: [16, 20], centre: [34, 0], radius: 2 },
                  ...(isDual
                    ? { rearSideBranch: { size: [16, 20], centre: [34, -90], radius: 2 } }
                    : {}),
                  holes: [-1, 1].flatMap((side) =>
                    [-1, 1].map((end) => [
                      side * (Number(item.parameters.baseLength) / 2 - 8),
                      (isDual ? -47 : -27) + end * (Number(item.parameters.baseWidth) / 2 - 8),
                    ]),
                  ),
                  holeDiameter: 4.5,
                },
                cableApproach: {
                  nativeMin: [-10, -9, -35],
                  nativeMax: [35, 9, -4.2],
                  translation: [0, -28, -15.2],
                  rotation: [0, 0, -90],
                  sourceRearFace: -4.1,
                  scope:
                    'Authored mounting clearance before the source rear face; actual sockets and mating plugs are absent from the source CAD.',
                },
                groundClip: {
                  finalMin: [14.5, -7, -5.1],
                  finalMax: [31.5, 7, -0.1],
                  approachStroke: 10,
                  lateralOffsets: [-1, 0, 1],
                },
                servoShaftEndSupports: {
                  nativePads: [
                    { min: [-5, 10, -4.5], size: [10, 7.8, 4.5] },
                    { min: [-5, -17.8, -4.5], size: [10, 7.8, 4.5] },
                  ],
                  sourceRearCoverSolid: 2,
                  nativeContactPlane: 0,
                  minimumContactAreaMm2: 18,
                  fixedRearPivot: { radius: 3, bottom: -4.1, top: -0.2 },
                  minimumRearPivotClearanceMm: 6.99,
                  downwardControlMm: 0.1,
                  minimumControlInterferenceMm3: 1.9,
                },
                servoShaftEndClamp: {
                  nativePads: [
                    { min: [-5, 9, 29], size: [10, 8.8, 3.7] },
                    { min: [-5, -17.8, 29], size: [10, 8.8, 3.7] },
                  ],
                  sourceFrontCoverSolid: 1,
                  nativeContactPlane: 29,
                  openingRadius: 10.5,
                  expectedContactAreaMm2: 17.60206311,
                  minimumDiscClearanceMm: 0.89,
                  upwardControlMm: 0.1,
                  minimumControlInterferenceMm3: 1.89,
                },
                rockerSandwich: {
                  hornMount: 'rocker-m3',
                  sourceOutputDiscSolid: 6,
                  sourceUpperDiscSolid: 7,
                  lowerDisc: { bottom: 31.2, top: 33.7, tappedDiameter: 3, pitch: 0.5 },
                  upperDisc: { rotationX: 180, translationZ: 40.35, bottom: 41.7, top: 43.9, clearanceDiameter: 3.2 },
                  rocker: { bossRadius: 9.6, bossBottom: 33.7, bodyBottom: 34.7, top: 41.7, centreDiameter: 9.2, clearanceDiameter: 3.2 },
                  axes: [[7, 0], [0, 7], [-7, 0], [0, -7]],
                  expectedContactAreaMm2: 178.94511755,
                  screw: { diameter: 3, length: 14, underHead: 43.9, tip: 29.9, engagement: 2.5, minimumCaseClearance: 0.89 },
                  minimumBodyClearanceMm: 2,
                  minimumBossClearanceMm: 0.9,
                  maximumSweepRadius: 33,
                },
                switchCase: {
                  size: [28, 16, 19],
                  origin: [-14, -8, -19],
                  pocketSize: [28.8, 16.8],
                  yawNegativeControls: [-3, 3],
                },
                splitPlane: 1.5,
                flangeBottom: 1.5,
                flangeTop: 7.5,
                gasketThickness: 1.5,
                switchNutSeat: { diameter: 18.6, floor: 6.8, depth: 0.7, minimumWeb: 5.3 },
                ...(isDual
                  ? {
                      frame: { worldRotationZ: -90, fixtureRotationZ: 90 },
                      manual: {
                        id: 'manual-toggle-switch',
                        placement: [0, -90, 0],
                        sourceCaseSize: [28, 16, 19],
                        sourceCaseOrigin: [-14, -98, -19],
                        rearAxes: [
                          [-22, -101],
                          [22, -76],
                        ],
                        nutSeatFloor: 6.8,
                        gasketId: 'parallel-manual-gasket',
                        gasketBore: 12.6,
                        groundClip: {
                          finalMin: [14.5, -97, -5.1],
                          finalMax: [31.5, -83, -0.1],
                          approachStroke: 10,
                          lateralOffsets: [-1, 0, 1],
                        },
                        guardSeat: {
                          sourceBaseSolid: 10,
                          centre: [-7, -90],
                          outerSize: [42.6, 19],
                          recessSize: [41, 17.4],
                          bottom: 7.5,
                          floor: 9.5,
                          top: 9.7,
                          recessDepth: 0.2,
                          centralSlot: { min: [-9.7, -101, 7.5], max: [9.7, -79, 10] },
                          yawNegativeControls: [-3, 3],
                          minimumContactAreaMm2: 100,
                          minimumLandContactAreaMm2: 30,
                        },
                        guard: {
                          pivot: [-15.5, -90, 14.7],
                          axis: [0, -1, 0],
                          sourceRotationZ: 180,
                          opening: 69,
                          sampleStep: 0.5,
                          closedExpression: pythonShape(sac01Cover(false)),
                          openExpression: pythonShape(sac01Cover(true)),
                          firstLeverExpressions: switchPieces(
                            {
                              ...panelSwitch.defaults,
                              model: 'daier-asw-07d-sac-01',
                              guard: 'open',
                              position: 'first',
                            },
                            'assembled',
                          )
                            .filter((piece) =>
                              /Chrome toggle actuator|Coloured LED actuator lens/.test(piece.label),
                            )
                            .map((piece) => pythonShape(piece.shape)),
                          leverPivot: [0, -90, 12.5],
                          leverTravel: [-12, 12],
                          auditSweep: item.parameters.manualState === 'open-off',
                        },
                      },
                    }
                  : {}),
              },
            }
          : {}),
        script: generateScript(part, item.parameters, item.state),
      };
    } finally {
      disposeModel(model);
    }
  });
const cachePath = new URL('../test-results/servo-toggle-actuator-validation.json', import.meta.url);
const cachedReport = (
  existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : { cases: [] }
) as {
  cases: {
    name: string;
    passed: boolean;
    codeSha256: string;
    installationFixtureSha256?: string;
  }[];
};
const cached = new Map(cachedReport.cases.map((row) => [row.name, row]));
let reused = 0;
const outputCases = cases.map((item) => {
  const installationFixtureSha256 = item.installationFixtures
      ? createHash('sha256').update(JSON.stringify(item.installationFixtures)).digest('hex')
      : undefined,
    prepared = installationFixtureSha256 ? { ...item, installationFixtureSha256 } : item,
    proof = cached.get(item.name);
  if (!proof) return prepared;
  const codeSha256 = createHash('sha256').update(item.script).digest('hex');
  if (
    !proof.passed ||
    proof.codeSha256 !== codeSha256 ||
    proof.installationFixtureSha256 !== installationFixtureSha256
  )
    return prepared;
  reused++;
  return {
    ...prepared,
    cachedNativeValidation: proof,
    cachedReport: 'test-results/servo-toggle-actuator-validation.json',
  };
});
const output = process.argv[2] ?? '/tmp/protolab-servo-toggle-actuator-cases.json';
writeFileSync(output, JSON.stringify(outputCases));
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    cachedNativeCases: reused,
    newNativeCases: cases.length - reused,
    components: cases.reduce((n, c) => n + c.components.length, 0),
  }),
);
