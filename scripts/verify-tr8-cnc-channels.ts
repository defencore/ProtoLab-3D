/** Independent native/preview cases for the narrow rotated-nut channel, before its shared frame. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import single, { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import { cncLayout, nativeThreadLayout, nutTravel, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/lib/layout';
import { libraries, channelPieces } from '../src/parts/tr8-quad-cnc-actuator/lib/channel';
import { actuatorExternalThreads } from '../src/parts/tr8-compact-actuator/lib/mating';
import { componentGeometry, componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import { disposeModel } from '../src/core/mechanical';
import { generateScript } from '../src/core/freecad';
import { validateParameters } from '../src/core/validation';
import type { Parameters, PartDefinition } from '../src/core/types';

const variant = process.argv[2] as CncVariant;
const layout = cncLayout(variant);
const directory = resolve(process.argv[3] ?? `test-results/${variant === 'coplanar-64' ? 'tr8-quad-cnc-actuator' : 'tr8-quad-staggered-actuator'}/channel`);
const units = [...new Set(layout.outputStations)].map(station => layout.outputStations.indexOf(station));
mkdirSync(directory, { recursive: true });
const travel = (angle: number) => nutTravel(layout, angle);
const pieces = (parameters: Parameters) =>
  channelPieces(parameters, Number(parameters.outputAngle), layout, Number(parameters.unitIndex ?? 0));
const build = (parameters: Parameters) => componentGeometry(libraries, pieces(parameters));
const study: PartDefinition = {
  ...single,
  id: (variant === 'coplanar-64' ? 'tr8-quad-cnc-actuator' : 'tr8-quad-staggered-actuator') + '-channel-study',
  defaults: {...single.defaults, unitIndex:0},
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
      layout.outputStations[Number(parameters.unitIndex ?? 0)] + travel(Number(parameters.outputAngle)),
      nativeThreadLayout(layout),
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
const cases = units.flatMap(unitIndex => [-20, 0, 20].map((angle) =>
  withGeometryMode('full', () => {
    const parameters = { ...study.defaults, outputAngle: angle, unitIndex };
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
      const name = `cnc-${variant}-tier-${unitIndex}-${angle < 0 ? 'minus-20deg' : angle > 0 ? 'plus-20deg' : 'neutral'}`;
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
            origin: [0, 0, layout.lever],
            axis: [1, 0, 0],
          },
        ],
        kinematics: {
          angle,
          displacement: travel(angle),
          crankRadius: layout.lever,
          pivot: [layout.outputStations[unitIndex], 0, 0],
          neutralNutX: layout.outputStations[unitIndex],
          variant,
          screwAxisZ: layout.lever,
          screwLead: 8,
        },
        billOfMaterials: study.composition!(parameters),
      };
    } finally {
      disposeModel(model);
    }
  }),
));
writeFileSync(resolve(directory, 'cases.json'), JSON.stringify(cases));
const proofCases = units.map(unitIndex => {
 const neutral = channelPieces(study.defaults, 0, layout, unitIndex);
 const ids=['nut-yoke','nut-flange-negative','nut-flange-positive'];
 const selected=ids.map(id=>neutral.find(p=>p.component.id===id)!);
 const external=actuatorExternalThreads(selected);
 return {unitIndex,neutralNutX:layout.outputStations[unitIndex],ids,pairs:ids.slice(1).map(id=>[id,'nut-yoke']),controls:ids.slice(1).map(id=>{
  const thread=external.find(p=>p.componentId===id&&p.diameter===3)!;
  return{first:id,second:'nut-yoke',angle:90,origin:thread.origin,axis:thread.axis};
 }),source:withGeometryMode('full',()=>componentPython(libraries,selected))};
});
const proof = `import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
cases=json.loads(${JSON.stringify(JSON.stringify(proofCases))})
results=[];controls=[]
for case in cases:
 scope=dict(App=App,Part=Part,math=math);exec(case['source'],scope)
 shapes=dict(zip(case['ids'],scope['components']))
 assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 for s in shapes.values())
 for first,second in case['pairs']:
  v=shapes[first].common(shapes[second]).Volume;assert abs(v)<=.001,(case['unitIndex'],first,second,v)
  results.append(dict(occurrenceIds=[first,second],neutralNutX=case['neutralNutX'],overlapMm3=v,overlapBudgetMm3=.001))
 for c in case['controls']:
  wrong=shapes[c['first']].copy();wrong.rotate(App.Vector(*c['origin']),App.Vector(*c['axis']),c['angle'])
  v=wrong.common(shapes[c['second']]).Volume;assert v>.001,(case['unitIndex'],c,v)
  controls.append(dict(occurrenceIds=[c['first'],c['second']],neutralNutX=case['neutralNutX'],angleDegrees=c['angle'],overlapMm3=v))
report=dict(schemaVersion=1,passed=True,sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),matedPairs=results,positiveControls=controls)
Path(__file__).with_name('thread-mating.json').write_text(json.dumps(report,indent=2));print(json.dumps(dict(passed=True,pairs=len(results),controls=len(controls))),flush=True)
`;
writeFileSync(resolve(directory,'thread-pair-proof.py'),proof);
console.log(JSON.stringify({variant,cases:cases.length,occurrences:channelPieces(study.defaults,0,layout,0).length,directory}));
