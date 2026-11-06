/** Prepare current product macros and independently measured preview data. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';
import usb from '../src/parts/usb-wireless-extender/part';
import platform from '../src/parts/recovery-electronics-platform/part';
import { mountingLayout } from '../src/parts/recovery-electronics-mount/part';
import usbEvidence from '../src/parts/usb-wireless-extender/lib/source-evidence.json';

const cases = [usb, platform].flatMap((part) =>
  part.states!.map((state) => {
    const model = part.buildGeometry(part.defaults, state.id);
    try {
      model.updateMatrixWorld(true);
      const components = model.children.map((child) => {
        const bounds = new Box3().setFromObject(child, true);
        let volume = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const position = mesh.geometry.getAttribute('position'),
            index = mesh.geometry.index;
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
      const composition = part.composition?.(part.defaults);
      return {
        name: part.id + '/' + state.id,
        id: part.id,
        state: state.id,
        parameters: part.defaults,
        components,
        sourceIds: composition?.components.map((component) =>
          Number(component.id.replace('source-', '')),
        ),
        sourceLibraryIds: composition?.components.map((component) => component.libraryId),
        script: generateScript(part, part.defaults, state.id),
      };
    } finally {
      disposeModel(model);
    }
  }),
);
const output = process.argv[2] ?? 'test-results/recovery-electronics-transfer/cases.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify({
    cases,
    usbEvidence,
    sourceWorldLowerUndersideZ: mountingLayout.sourceWorldLowerUndersideZ,
  }),
);
console.log(JSON.stringify({ cases: cases.length, output }));
