/** Prepare fixed supplier CAD macros and independently measured preview envelopes.
 * Run the result in isolated FreeCAD Python with a native source/roundtrip auditor.
 */
import { writeFileSync } from 'node:fs';
import { Box3, Mesh, Vector3 } from 'three';
import part from '../src/parts/rover-chassis/part';
import { selectedComponents } from '../src/parts/rover-chassis/lib/model';
import { disposeModel } from '../src/core/mechanical';
import { validateParameters } from '../src/core/validation';
import { generateScript } from '../src/core/freecad';

const cases = part.presets.flatMap((preset) =>
  part.states!.map((state) => {
    const errors = validateParameters(part, preset.parameters, state.id);
    if (errors.length) throw new Error(errors.join('; '));
    const model = part.buildGeometry(preset.parameters, state.id);
    const source = selectedComponents(preset.parameters, state.id);
    try {
      model.updateMatrixWorld(true);
      const components = model.children.map((child, index) => {
        const bounds = new Box3().setFromObject(child, true);
        let volume = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
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
          id: source[index].id,
          name: child.name,
          group: source[index].group,
          sourceVolume: source[index].volume,
          sourceSolids: source[index].solids ?? 1,
          min: bounds.min.toArray(),
          max: bounds.max.toArray(),
          volume,
        };
      });
      return {
        name: `${part.id}/${preset.id}/${state.id}`,
        id: part.id,
        state: state.id,
        parameters: preset.parameters,
        sourceUrl: preset.catalog!.geometryEvidence!.sourceUrl,
        sourceSha256: preset.catalog!.geometryEvidence!.sourceSha256,
        components,
        script: generateScript(part, preset.parameters, state.id),
      };
    } finally {
      disposeModel(model);
    }
  }),
);
const output = process.argv[2] ?? '/tmp/protolab-rover-chassis-cases.json';
writeFileSync(output, JSON.stringify(cases));
console.log(
  JSON.stringify({
    cases: cases.length,
    components: cases.reduce((count, entry) => count + entry.components.length, 0),
    output,
  }),
);
