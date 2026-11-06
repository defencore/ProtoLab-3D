/** Independent native/preview cases for the narrow rotated-nut channel, before its shared frame. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import single, { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import { mechanismLayout, nativeThreadLayout } from '../src/parts/tr8-quad-mini-actuator/lib/layout';
import { libraries, mechanismPieces } from '../src/parts/tr8-quad-mini-actuator/lib/mechanism';
import { actuatorExternalThreads } from '../src/parts/tr8-compact-actuator/lib/mating';
import { componentGeometry, componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { Parameters, PartDefinition } from '../src/core/types';

const directory = resolve(process.argv[2] ?? 'test-results/tr8-quad-mini-actuator/channel');
mkdirSync(directory, { recursive: true });
const travel = (angle: number) => mechanismLayout.radius * Math.tan((angle * Math.PI) / 180);
const pieces = (parameters: Parameters) =>
  mechanismPieces(parameters, Number(parameters.outputAngle));
const build = (parameters: Parameters) => componentGeometry(libraries, pieces(parameters));
const study: PartDefinition = {
  ...single,
  id: 'tr8-quad-mini-channel-study',
  name: 'Mini quad narrow TR8 channel · rotated H nut',
  description:
    'Frame-free native study of the quad-specific stepped carrier and narrow output hardware.',
  notes:
    'Geometry verification only. The quad shared structural plates and columns are deliberately omitted.',
  buildGeometry: build,
  dimensions(parameters) {
    const geometry = build(parameters);
    try {
      return new Box3().setFromObject(geometry, true).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
    } finally {
      disposeModel(geometry);
    }
  },
  python: (parameters) =>
    actuatorNativeSource(
      pieces(parameters),
      travel(Number(parameters.outputAngle)),
      nativeThreadLayout,
      libraries,
    ),
  validate(parameters) {
    return pieces(parameters).flatMap((piece) =>
      validateParameters(
        libraries.find((library) => library.id === piece.component.libraryId)!,
        piece.component.parameters,
        piece.component.state,
      ),
    );
  },
  composition: (parameters) => ({ components: pieces(parameters).map((piece) => piece.component) }),
};
const cases = [-20, 0, 20].map((angle) =>
  withGeometryMode('full', () => {
    const parameters = { ...study.defaults, outputAngle: angle };
    const occurrences = pieces(parameters);
    const model = build(parameters);
    model.updateMatrixWorld(true);
    try {
      const expected = model.children.map((child, index) => {
        const box = new Box3().setFromObject(child, true);
        let volume = 0;
        child.traverse((mesh) => {
          if (!(mesh instanceof Mesh)) return;
          const position = mesh.geometry.getAttribute('position'),
            indices = mesh.geometry.index;
          for (let triangle = 0; triangle < (indices?.count ?? position.count); triangle += 3) {
            const [a, b, c] = [0, 1, 2].map((offset) =>
              new Vector3()
                .fromBufferAttribute(
                  position,
                  indices ? indices.getX(triangle + offset) : triangle + offset,
                )
                .applyMatrix4(mesh.matrixWorld),
            );
            volume += a.dot(b.clone().cross(c)) / 6;
          }
        });
        return {
          id: occurrences[index].component.id,
          libraryId: occurrences[index].component.libraryId,
          label: occurrences[index].label,
          min: box.min.toArray(),
          max: box.max.toArray(),
          volume,
        };
      });
      const name = `quad-mini-channel-${angle < 0 ? 'minus-20deg' : angle > 0 ? 'plus-20deg' : 'neutral'}`;
      const script = generateScript(study, parameters, 'assembled', undefined, undefined, 'full');
      writeFileSync(resolve(directory, name + '.FCMacro'), script);
      return {
        name,
        id: study.id,
        mode: 'full',
        state: 'assembled',
        export: true,
        parameters,
        expected,
        script,
        source: study.python(parameters, 'assembled'),
        nominalSource: withGeometryMode('simple', () => study.python(parameters, 'assembled')),
        dimensions: study.dimensions(parameters, 'assembled'),
        driveAxes: [
          {
            screw: 'lead-screw',
            nut: 'lead-nut',
            origin: [0, 0, mechanismLayout.screwZ],
            axis: [1, 0, 0],
          },
        ],
        kinematics: {
          angle,
          displacement: travel(angle),
          crankRadius: mechanismLayout.radius,
          pivot: [mechanismLayout.outputX, 0, 0],
          screwAxisZ: mechanismLayout.screwZ,
          screwLead: 8,
        },
        billOfMaterials: study.composition!(parameters),
      };
    } finally {
      disposeModel(model);
    }
  }),
);
writeFileSync(resolve(directory, 'cases.json'), JSON.stringify(cases));
const neutral = mechanismPieces(study.defaults, 0);
const available = new Set(neutral.map((piece) => piece.component.id));
const pairIds = [
  ['nut-flange-negative', 'nut-yoke'],
  ['nut-flange-positive', 'nut-yoke'],
].filter((pair) => pair.every((id) => available.has(id)));
const ids = [...new Set(pairIds.flat())];
const selected = ids.map((id) => {
  const piece = neutral.find((item) => item.component.id === id);
  if (!piece) throw new Error('Missing native channel pair: ' + id);
  return piece;
});
const exterior = actuatorExternalThreads(selected);
const controls = [
  ['nut-flange-negative', 'nut-yoke', 3, 90],
  ['nut-flange-positive', 'nut-yoke', 3, 90],
]
  .filter(([first, second]) => available.has(String(first)) && available.has(String(second)))
  .map(([first, second, diameter, angle]) => {
    const thread = exterior.find(
      (item) => item.componentId === first && item.diameter === diameter,
    );
    if (!thread) throw new Error('Missing native channel control: ' + first);
    return { first, second, angle, origin: thread.origin, axis: thread.axis };
  });
const source = withGeometryMode('full', () => componentPython(libraries, selected));
const proof = `import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App, Part
${source}
ids=json.loads(${JSON.stringify(JSON.stringify(ids))})
pairs=json.loads(${JSON.stringify(JSON.stringify(pairIds))})
control_specs=json.loads(${JSON.stringify(JSON.stringify(controls))})
assert all(shape.isValid() and shape.isClosed() and len(shape.Solids)==1 for shape in components)
results=[]
for first,second in pairs:
 volume=components[ids.index(first)].common(components[ids.index(second)]).Volume
 assert abs(volume)<=.001,(first,second,volume)
 results.append(dict(occurrenceIds=[first,second],overlapMm3=volume,overlapBudgetMm3=.001))
controls=[]
for control in control_specs:
 shape=components[ids.index(control['first'])].copy()
 shape.rotate(App.Vector(*control['origin']),App.Vector(*control['axis']),control['angle'])
 volume=shape.common(components[ids.index(control['second'])]).Volume
 assert volume>.001,(control,volume)
 controls.append(dict(occurrenceIds=[control['first'],control['second']],angleDegrees=control['angle'],overlapMm3=volume))
report=dict(schemaVersion=1,sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),matedPairs=results,positiveControls=controls)
Path(__file__).with_name('thread-mating.json').write_text(json.dumps(report,indent=2))
print(json.dumps(dict(passed=True,pairs=len(results),controls=len(controls))),flush=True)
`;
writeFileSync(resolve(directory, 'thread-pair-proof.py'), proof);
console.log(
  JSON.stringify({
    cases: cases.length,
    occurrences: neutral.length,
    directory,
    casesSha256: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
  }),
);
