/** Actual library dowels must engage both prepared fork walls and the shaft. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Euler, Vector3 } from 'three';
import { componentPython } from '../src/core/assembly/detail-instances';
import { withGeometryMode } from '../src/core/geometry-mode';
import single from '../src/parts/tr8-compact-actuator/part';
import { libraries, channelPieces } from '../src/parts/tr8-quad-cnc-actuator/lib/channel';
import { cncLayout, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/lib/layout';
const variant=process.argv[2] as CncVariant,layout=cncLayout(variant);
const directory=resolve(process.argv[3]??`test-results/${variant==='coplanar-64'?'tr8-quad-cnc-actuator':'tr8-quad-staggered-actuator'}/channel`);
const units=[...new Set(layout.outputStations)].map(station=>layout.outputStations.indexOf(station));
const cases = units.flatMap(unitIndex=>[-20, 0, 20].map((angle) =>
  withGeometryMode('full', () => {
    const pieces = channelPieces(single.defaults, angle, layout, unitIndex);
    const pins = pieces.filter((p) => p.component.libraryId === 'dowel-pin');
    if (pins.length !== 1) throw new Error('Expected one purchased transverse dowel.');
    const joints = pins.map(({ component: c }) => {
      const rotation = new Euler(
        ...(c.placement.rotation.map((v) => (v * Math.PI) / 180) as [number, number, number]),
        'ZYX',
      );
      const center = new Vector3(0, 0, Number(c.parameters.length) / 2)
        .applyEuler(rotation)
        .add(new Vector3(...c.placement.translation));
      const direction = new Vector3(0, 0, 1).applyEuler(rotation);
      if (
        Number(c.parameters.diameter) !== 2 ||
        Number(c.parameters.length) !== 10 ||
        Number(c.parameters.chamfer) > 0.6
      )
        throw new Error('Expected the nominal Ø2×10 pin with no more than0.6 mm lead.');
      return {
        pin: c.id,
        fork: 'output-rear-crank',
        center: center.toArray(),
        direction: direction.toArray(),
        parameters: c.parameters,
      };
    });
    const selected = pieces.filter((p) =>
      [
        'output-shaft',
        'output-rear-crank',
        ...pins.map((p) => p.component.id),
      ].includes(p.component.id),
    );
    return {
      angle,
      neutralNutX:layout.outputStations[unitIndex],
      joints,
      ids: selected.map((p) => p.component.id),
      source: componentPython(libraries, selected),
    };
  }),
));
const casesSha256 = createHash('sha256')
  .update(readFileSync(resolve(directory, 'cases.json')))
  .digest('hex');
const code = `import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
rows=[]
for case in cases:
 scope=dict(App=App,Part=Part,math=__import__('math'));exec(case['source'],scope)
 shapes=dict(zip(case['ids'],scope['components']))
 assert all(s.isValid() and s.isClosed() and len(s.Solids)==1 for s in shapes.values())
 for joint in case['joints']:
  pin,fork,shaft=[shapes[joint[key]] if key!='shaft' else shapes['output-shaft'] for key in ['pin','fork','shaft']]
  centre=App.Vector(*joint['center']);axis=App.Vector(*joint['direction'])
  overlaps=dict(fork=pin.common(fork).Volume,shaft=pin.common(shaft).Volume)
  assert all(abs(v)<=1e-6 for v in overlaps.values()),('Nominal pin/hole contact intersects',case['angle'],joint['pin'],overlaps)
  wall_checks=[]
  for sign in [-1,1]:
   start=centre+axis*(-4.3 if sign<0 else 3.1)
   witness=Part.makeCylinder(.99,1.2,start,axis)
   escaped=witness.cut(pin).Volume
   assert abs(escaped)<=1e-6,('Pin does not fully engage both hub walls',case['angle'],joint['pin'],sign,escaped)
   for side in [-1,1]:
    in_hole=centre+axis*(sign*3.5)+App.Vector(0,side*.95,0)
    in_hub=centre+axis*(sign*3.5)+App.Vector(0,side*1.1,0)
    in_shaft=centre+axis*(sign*1.5)+App.Vector(0,side*1.1,0)
    assert pin.isInside(in_hole,1e-7,False) and not fork.isInside(in_hole,1e-7,False)
    assert fork.isInside(in_hub,1e-7,False) and shaft.isInside(in_shaft,1e-7,False)
   wall_checks.append(dict(side=sign,witnessLengthMm=1.2,witnessDiameterMm=1.98,escapedMm3=escaped))
  wrong=pin.copy();wrong.rotate(App.Vector(case['neutralNutX'],0,0),App.Vector(0,1,0),90)
  positive=dict(fork=wrong.common(fork).Volume,shaft=wrong.common(shaft).Volume)
  assert all(v>.01 for v in positive.values()),('Wrong-phase pin control failed',positive)
  rows.append(dict(angle=case['angle'],neutralNutX=case['neutralNutX'],pin=joint['pin'],nominalContactOverlapMm3=overlaps,hubWalls=wall_checks,wrongPhaseDegrees=90,wrongPhaseOverlapMm3=positive))
  print(json.dumps(dict(angle=case['angle'],neutralNutX=case['neutralNutX'],pin=joint['pin'],passed=True)),flush=True)
report=dict(passed=True,casesSha256=${JSON.stringify(casesSha256)},sourceSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runtimeSha256=hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),joints=rows,sourcePolicy='Actual public dowel-pin library solids; nominal Ø2 pin/hole contacts; independent material witnesses in both prepared hub walls and the shaft; supplier lead up to0.6 mm. Assign production fits before pressing.')
Path(__file__).with_name('pin-joints.json').write_text(json.dumps(report,indent=2))
print(json.dumps(dict(passed=True,joints=len(rows))),flush=True)
`;
writeFileSync(resolve(directory, 'pin-joint-proof.py'), code);
console.log(JSON.stringify({ poses: cases.length, joints: cases.length, directory }));
