/** Whole-assembly cases for the two public CNC quad arrangements. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Vector3 } from 'three';
import { createCncQuadDefinition, cncPieces, cncChannels, cncLayout, channelPieces,
  nativeThreadLayout, libraries, nutTravel, type CncVariant } from '../src/parts/tr8-quad-cnc-actuator/part';
import { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import { withGeometryMode } from '../src/core/geometry-mode';
import { generateScript } from '../src/core/freecad';
import { disposeModel } from '../src/core/mechanical';

const variant = process.argv[2] as CncVariant;
const layout = cncLayout(variant), part = createCncQuadDefinition(variant);
const directory = resolve(process.argv[3] ?? `test-results/${part.id}`);
mkdirSync(directory, { recursive: true });
const localCases = JSON.parse(readFileSync(resolve(directory, 'channel/cases.json'), 'utf8')) as {
  name: string; parameters: {outputAngle:number}; kinematics: {neutralNutX:number};
}[];
const prefix = variant === 'coplanar-64' ? 'cnc64' : 'cnc56';
const cases = (['simple', 'full'] as const).map(mode => withGeometryMode(mode, () => {
  const angles = mode === 'simple' ? [0,0,0,0] : [-20,20,-20,20];
  const parameters = { ...part.defaults, ...Object.fromEntries(angles.map((angle,i) => ['angle'+'ABCD'[i], angle])) };
  const errors = part.validate(parameters, 'assembled');
  if (errors.length) throw new Error(errors.join('; '));
  const pieces = cncPieces(parameters, 'assembled', variant), model = part.buildGeometry(parameters, 'assembled');
  model.updateMatrixWorld(true);
  try {
    const expected = model.children.map((child,index) => {
      const box = new Box3().setFromObject(child,true);
      let volume = 0;
      child.traverse(mesh => {
        if (!(mesh instanceof Mesh)) return;
        const positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index;
        for (let triangle=0;triangle<(indices?.count??positions.count);triangle+=3) {
          const [a,b,c] = [0,1,2].map(offset => new Vector3().fromBufferAttribute(positions,
            indices?indices.getX(triangle+offset):triangle+offset).applyMatrix4(mesh.matrixWorld));
          volume += a.dot(b.clone().cross(c))/6;
        }
      });
      return { id:pieces[index].component.id, libraryId:pieces[index].component.libraryId,
        label:pieces[index].label, min:box.min.toArray(), max:box.max.toArray(), volume };
    });
    const name = prefix+'-'+mode+'-'+(mode==='simple'?'neutral':'mixed');
    const source = part.python(parameters,'assembled'), script = generateScript(part,parameters,'assembled',undefined,undefined,mode);
    writeFileSync(resolve(directory,name+'.FCMacro'),script);
    const mounts = cncChannels(parameters,'assembled',layout);
    return { name, id:part.id, mode, state:'assembled', export:true, parameters, expected, source, script,
      nominalSource: mode==='full' ? withGeometryMode('simple',()=>part.python(parameters,'assembled')) : undefined,
      dimensions:new Box3().setFromObject(model,true).getSize(new Vector3()).toArray(),
      channelPlacements:mounts, frameLayout:layout,
      crossChannelStockProof:{kind:'cnc-family',report:'channel/swept-stock.json',cases:'channel/cases.json',audit:'channel/native-report.json',verifierScript:'verify-tr8-cnc-swept-stock.py'},
      kinematics:{crankRadius:layout.lever,pivot:[0,0,0],screwAxisZ:layout.lever,screwLead:8},
      prototypeAudit:mode==='full'?{cases:'channel/cases.json',report:'channel/native-report.json',
        channels:mounts.map(channel=>{
          const local = localCases.find(c=>c.parameters.outputAngle===channel.angle && c.kinematics.neutralNutX===channel.neutralNutX);
          if (!local) throw new Error('Missing tier-specific prototype case.');
          return {id:channel.id,angle:channel.angle,neutralNutX:channel.neutralNutX,caseName:local.name,
            source:actuatorNativeSource(channelPieces(parameters,channel.angle,layout,channel.unit),channel.neutralNutX+nutTravel(layout,channel.angle),nativeThreadLayout(layout),libraries)};
        })}:undefined,
      driveAxes:mounts.map(channel=>({screw:channel.id+'-lead-screw',nut:channel.id+'-lead-nut',
        origin:[0,channel.origin[1]-layout.lever*Math.sin(channel.clock*Math.PI/180),channel.origin[2]+layout.lever*Math.cos(channel.clock*Math.PI/180)],axis:[1,0,0]})),
      billOfMaterials:part.composition!(parameters),
    };
  } finally { disposeModel(model); }
}));
writeFileSync(resolve(directory,'cases.json'),JSON.stringify(cases));
withGeometryMode('full',()=>{
  for(const file of part.fabricationFiles!(part.defaults)) writeFileSync(resolve(directory,file.name),file.content);
});
console.log(JSON.stringify({variant,cases:cases.length,occurrences:cases[0].expected.length,dimensions:cases[0].dimensions,directory}));
