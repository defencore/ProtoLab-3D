/** Prepare CAD macros and preview measurements for the fixed servo model catalog. */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import { parts } from '../src/parts';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import { presetMatchesConfiguration } from '../src/core/catalog-models';

const selections = parts.filter((part) => part.id === 'servo-motor');
if (selections.length !== 1 || !selections[0].presets.length)
  throw new Error('Expected one nonempty servo motor catalog.');

const cases = selections.flatMap((part) => {
  const configurations = [
    { id: 'default', parameters: part.defaults },
    ...part.presets,
    ...part.presets.flatMap((preset) =>
      [-45, 45].map((angle) => ({
        id: `${preset.id}/horn-${angle}`,
        parameters: {
          ...preset.parameters,
          showHorn: true,
          hornStyle: 'single',
          outputAngle: angle,
        },
      })),
    ),
    ...[0, 45].map((outputAngle) => ({
      id: `waveshare-st3215-hs/supplied-discs-${outputAngle}`,
      parameters: {
        ...part.presets.find((preset) => preset.parameters.model === 'waveshare-st3215-hs')!
          .parameters,
        showHorn: true,
        hornStyle: 'disc',
        outputAngle,
      },
    })),
  ];
  return configurations.flatMap((configuration) =>
    part.states!.map((state) => {
      const model = part.buildGeometry(configuration.parameters, state.id);
      try {
        model.updateMatrixWorld(true);
        const components = model.children.map((child) => {
          const bounds = new Box3().setFromObject(child, true);
          let volume = 0;
          child.traverse((mesh) => {
            if (!(mesh instanceof Mesh)) return;
            const position = mesh.geometry.getAttribute('position');
            const index = mesh.geometry.index;
            for (let i = 0; i < (index?.count ?? position.count); i += 3) {
              const vertices = [0, 1, 2].map((j) =>
                new Vector3()
                  .fromBufferAttribute(position, index ? index.getX(i + j) : i + j)
                  .applyMatrix4(mesh.matrixWorld),
              );
              volume += vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
            }
          });
          return { name: child.name, min: bounds.min.toArray(), max: bounds.max.toArray(), volume };
        });
        const catalog = part.presets.find((preset) =>
          presetMatchesConfiguration(part, preset, configuration.parameters),
        )?.catalog;
        if (!catalog) throw new Error(`Missing fixed model source: ${configuration.id}`);
        return {
          name: `${part.id}/${configuration.id}/${state.id}`,
          id: part.id,
          state: state.id,
          parameters: configuration.parameters,
          catalog: {
            designation: catalog.designation,
            source: catalog.sourceUrl,
            dimensions: Object.fromEntries(
              catalog.verifiedParameters.map((key) => [key, configuration.parameters[key]]),
            ),
            attributes: catalog.attributes,
            attributeConditions: catalog.attributeConditions,
          },
          components,
          script: generateScript(part, configuration.parameters, state.id),
        };
      } finally {
        disposeModel(model);
      }
    }),
  );
});
const output = process.argv[2] ?? '/tmp/protolab-servo-motors-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(JSON.stringify({ cases: cases.length, output }));
