/** Prepare a bounded physical native-CAD audit; references are deliberately excluded. */
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/handheld-lora-controller/part';
import { configuredPieces, libraries } from '../src/parts/handheld-lora-controller/lib/model';
import { layout, board } from '../src/parts/handheld-lora-controller/lib/layout';
import { reinforcement } from '../src/parts/handheld-lora-controller/lib/reinforcement';
import { roundedFloorEnvelope } from '../src/parts/handheld-lora-controller/lib/grip';
import { casePrism } from '../src/parts/handheld-lora-controller/lib/shapes';
import {
  webButton,
  webPlungerAtTravel,
  webSliderAtTravel,
} from '../src/parts/handheld-lora-controller/lib/web-button';
import { pythonShape, type Shape } from '../src/core/assembly/boundary/shapes';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { componentPython } from '../src/core/assembly/detail-instances';
import { validateParameters } from '../src/core/validation';

const output = resolve(process.argv[2] ?? 'test-results/handheld-lora-body-models');
mkdirSync(output, { recursive: true });
await part.initializeGeometry?.(part.defaults, 'assembled');
const planned = part.presets.map((preset) => ({
  state: 'assembled',
  presetId: preset.id,
  parameters: { ...part.defaults, ...preset.parameters },
}));
const compact = planned.find(
  (item) =>
    item.parameters.bodyModel === 'contoured' &&
    item.parameters.antennaType === 'external' &&
    item.parameters.externalMount === 'compact-top',
)!;
const internal = planned.find(
  (item) => item.parameters.bodyModel === 'contoured' && item.parameters.antennaType === 'internal',
)!;
const selected = process.argv[3]?.startsWith('preset:')
  ? planned.filter((item) => item.presetId === process.argv[3].slice('preset:'.length))
  : process.argv[3] === 'contoured'
    ? planned.filter((item) => item.parameters.bodyModel === 'contoured')
    : process.argv[3] === 'non-web'
      ? planned.filter((item) => item.parameters.bodyModel !== 'web-grip')
      : process.argv[3] === 'web'
        ? planned.filter((item) => item.parameters.bodyModel === 'web-grip')
        : process.argv[3] === 'web-preflight'
          ? [
              planned.find(
                (item) =>
                  item.parameters.bodyModel === 'web-grip' &&
                  item.parameters.antennaType === 'internal',
              )!,
            ]
          : process.argv[3] === 'compact-preflight'
            ? [compact]
            : process.argv[3] === 'preflight'
              ? [compact, internal]
              : planned;
const ordered = [...selected];
if (process.env.HANDHELD_WEB_FIRST === '1')
  ordered.sort((a, b) => {
    const order = (item: (typeof selected)[number]) =>
      item.parameters.bodyModel === 'web-grip'
        ? item.parameters.antennaType === 'internal'
          ? 0
          : 1
        : 2;
    return order(a) - order(b);
  });
const completedCases: Record<string, unknown>[] = [];
const cases = ordered.map((item) => {
  const parameters = item.parameters;
  const errors = validateParameters(part, parameters, item.state);
  if (errors.length) throw new Error(errors.join('; '));
  const definitions = configuredPieces(parameters, item.state).filter(
    (piece) => piece.component.supply !== 'reference',
  );
  const model = (part.buildExportGeometry ?? part.buildGeometry)(parameters, item.state);
  try {
    model.updateMatrixWorld(true);
    if (model.children.length !== definitions.length)
      throw new Error('Physical component count mismatch');
    const components = model.children.map((child, i) => {
      const bounds = new Box3().setFromObject(child, true);
      let volume = 0,
        solids = 0;
      const capture =
        process.env.HANDHELD_EXPORT_MESHES === '1' &&
        definitions[i].component.supply === 'manufactured' &&
        definitions[i].component.manufacturing?.processes.includes('printing');
      const meshes: {
        positions: number[];
        indices: number[] | null;
        matrixWorld: number[];
      }[] = [];
      child.traverse((mesh) => {
        if (!(mesh instanceof Mesh)) return;
        solids++;
        const position = mesh.geometry.getAttribute('position'),
          index = mesh.geometry.index;
        if (capture)
          meshes.push({
            positions: Array.from(position.array),
            indices: index ? Array.from(index.array) : null,
            matrixWorld: mesh.matrixWorld.toArray(),
          });
        for (let i = 0; i < (index?.count ?? position.count); i += 3) {
          const [a, b, c] = [0, 1, 2].map((j) =>
            new Vector3()
              .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
              .applyMatrix4(mesh.matrixWorld),
          );
          volume += a.dot(b.clone().cross(c)) / 6;
        }
      });
      const metrics = {
        ...definitions[i].component,
        label: child.name,
        min: bounds.min.toArray(),
        max: bounds.max.toArray(),
        volume,
        solids,
      };
      if (capture) {
        if (meshes.length !== 1) throw new Error('A manufactured print must have one raw mesh');
        const folder = resolve(output, 'raw-meshes', item.presetId);
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          resolve(folder, definitions[i].component.id + '.json'),
          JSON.stringify({
            presetId: item.presetId,
            componentId: definitions[i].component.id,
            processes: definitions[i].component.manufacturing!.processes,
            componentSHA256: createHash('sha256')
              .update(JSON.stringify(definitions[i].component))
              .digest('hex'),
            parameters,
            state: item.state,
            metrics: { min: metrics.min, max: metrics.max, volume, solids },
            positionComponentType: 'Float32',
            meshes,
          }),
        );
      }
      return metrics;
    });
    const measuredDimensions = new Box3()
      .setFromObject(model, true)
      .getSize(new Vector3())
      .toArray() as [number, number, number];
    const name = `handheld-${planned.indexOf(item)}-${parameters.bodyModel}-${parameters.antennaType}-${parameters.externalMount}-${item.state}`,
      script = generateScript(
        { ...part, exportDimensions: () => measuredDimensions },
        parameters,
        item.state,
      );
    writeFileSync(resolve(output, `${name}.FCMacro`), script);
    const references = configuredPieces(parameters, item.state).filter(
      (piece) => piece.component.supply === 'reference',
    );
    const row = {
      name,
      id: part.id,
      state: item.state,
      presetId: item.presetId,
      antennaType: parameters.antennaType,
      externalMount: parameters.externalMount,
      bodyModel: parameters.bodyModel,
      parameters,
      layout: layout(parameters),
      board,
      reinforcement,
      caseOuterEnvelopeCode: shapeCode({
        kind: 'intersect',
        children: [casePrism(0, -3, 35), roundedFloorEnvelope(parameters)],
      }),
      antennaOuterEnvelopeCode:
        parameters.antennaType === 'external'
          ? shapeCode({
              kind: 'intersect',
              children: [casePrism(0, -3, 35), roundedFloorEnvelope(parameters)],
            })
          : null,
      components,
      script,
      references: references.map((piece) => ({
        id: piece.component.id,
        label: piece.label,
      })),
      referenceCode: references.length ? componentPython(libraries, references) : null,
      webMotion:
        parameters.bodyModel === 'web-grip'
          ? {
              layout: webButton,
              plungers: [
                0,
                webButton.paddle.takeUp / 2,
                webButton.paddle.takeUp,
                webButton.paddle.takeUp + 0.5,
                webButton.paddle.stroke,
              ].map((stroke) => ({
                stroke,
                code: shapeCode(webPlungerAtTravel(stroke)),
              })),
              sliders: [
                ...webButton.slider.stopProbeTravels,
                ...Array.from({ length: 22 }, (_, i) => (i * 8.4) / 21),
              ]
                .map((travel) => ({
                  travel,
                  normalOffset: 0,
                  code: shapeCode(webSliderAtTravel(travel)),
                }))
                .concat(
                  [-0.1, 0.1].flatMap((normalOffset) =>
                    [0, 8.4].map((travel) => ({
                      travel,
                      normalOffset,
                      code: shapeCode(webSliderAtTravel(travel, normalOffset)),
                    })),
                  ),
                ),
              clamp: (() => {
                const ids = ['clamp-screw', 'clamp-washer', 'clamp-nut'];
                const pieces = configuredPieces(
                  { ...parameters, safetyPosition: 'locked' },
                  'assembled',
                ).filter((piece) => ids.includes(piece.component.id));
                if (pieces.length !== ids.length)
                  throw new Error('Palm Lock friction clamp is missing physical hardware');
                return {
                  ids,
                  code: `${componentPython(libraries, pieces)}\nshape = Part.makeCompound(components)`,
                };
              })(),
              relock: (() => {
                const travels = [
                  ...Array.from({ length: 22 }, (_, i) => (i * 8.4) / 21),
                  ...Array.from({ length: 15 }, (_, i) => 6.3 + i * 0.05),
                ];
                const unique = [...new Set(travels.map((travel) => Number(travel.toFixed(6))))];
                return [0, -0.1].flatMap((normalOffset) =>
                  unique.map((travel) => {
                    const camFraction = Math.max(0, Math.min(1, (7 - travel) / 0.7)),
                      stroke = Math.max(
                        0,
                        Math.min(webButton.paddle.takeUp, 0.7 - 0.55 * camFraction - normalOffset) -
                          0.005,
                      );
                    return {
                      travel,
                      normalOffset,
                      stroke,
                      plungerCode: shapeCode(webPlungerAtTravel(stroke)),
                      sliderCode: shapeCode(webSliderAtTravel(travel, normalOffset)),
                    };
                  }),
                );
              })(),
              stocks: ['first', 'last'].map((position) => ({
                position,
                code: componentPython(
                  libraries,
                  configuredPieces(
                    { ...parameters, safetyPosition: 'unlocked', buttonA: position },
                    'assembled',
                  ).filter((piece) => piece.component.id === 'button-a'),
                ),
              })),
            }
          : null,
    };
    completedCases.push(row);
    const pending = resolve(output, 'cases.json.tmp');
    writeFileSync(pending, JSON.stringify(completedCases));
    renameSync(pending, resolve(output, 'cases.json'));
    console.log(JSON.stringify({ prepared: item.presetId, completed: completedCases.length }));
    return row;
  } finally {
    disposeModel(model);
  }
});
writeFileSync(resolve(output, 'cases.json'), JSON.stringify(cases));
console.log(
  JSON.stringify({
    output,
    cases: cases.length,
    components: cases.reduce((n, row) => n + row.components.length, 0),
  }),
);

function shapeCode(shape: Shape): string {
  return `def _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):\n        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape = (${pythonShape(shape)}).removeSplitter()`;
}
