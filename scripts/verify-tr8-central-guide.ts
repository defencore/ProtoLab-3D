/** Capture actual public guided APIs for source-bound native change validation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { detailComponent } from '../src/core/component-recipes';
import { union } from '../src/core/assembly/boundary/shapes';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import { modelEvidence } from '../src/core/model-evidence';
import base64,{cncPieces,cncLayout,cncMiddleShape,libraries,carrierBodyShape} from '../src/parts/tr8-quad-cnc-actuator/part';
import base56 from '../src/parts/tr8-quad-staggered-actuator/part';
import guided64,{guidedPieces,guideShape,centralGuideFaces,centralGuideLayout} from '../src/parts/tr8-quad-guided-actuator/part';
import guided56 from '../src/parts/tr8-quad-guided-staggered-actuator/part';

const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const directory=resolve(process.argv[2]??'test-results/tr8-central-guide/validation');
mkdirSync(directory,{recursive:true});
const sources=[
 'src/parts/tr8-quad-cnc-actuator/lib/central-guide.ts','src/parts/tr8-quad-cnc-actuator/lib/frame.ts',
 'src/parts/tr8-quad-cnc-actuator/lib/layout.ts','src/parts/tr8-quad-cnc-actuator/lib/linkage.ts',
 'src/parts/tr8-quad-cnc-actuator/lib/channel.ts','src/parts/tr8-quad-cnc-actuator/lib/native.ts',
 'src/parts/tr8-quad-guided-actuator/part.ts','src/parts/tr8-quad-guided-actuator/lib/frame.ts',
 'src/parts/tr8-quad-guided-staggered-actuator/part.ts',
].map(path=>({path,sha256:sha(readFileSync(path))}));
const mixed={angleA:-20,angleB:20,angleC:-20,angleD:20};
const cases=[];
for(const [variant,part,base,stem] of [
 ['coplanar-64',guided64,base64,'cnc64'],['staggered-56',guided56,base56,'cnc56'],
] as const) {
 const layout=cncLayout(variant), oldDirectory=resolve('test-results',base.id);
 const oldCasesPath=resolve(oldDirectory,'cases.json'), oldCases=JSON.parse(readFileSync(oldCasesPath,'utf8'));
 const modes=(['simple','full'] as const).map(mode=>withGeometryMode(mode,()=> {
  const parameters={...part.defaults,...(mode==='full'?mixed:{angleA:0,angleB:0,angleC:0,angleD:0})};
  const old=cncPieces(parameters,'assembled',variant), now=guidedPieces(parameters,'assembled',variant);
  assert.deepEqual(now.filter(p=>p.component.id!=='cnc-middle-body'),old.filter(p=>p.component.id!=='cnc-middle-body'));
  const actualMiddle=now.find(p=>p.component.id==='cnc-middle-body')!.component;
  const expectedMiddle=detailComponent(actualMiddle.id,actualMiddle.name,union(cncMiddleShape(layout),guideShape(layout)));
  assert.deepEqual(actualMiddle.parameters,expectedMiddle.parameters);assert.deepEqual(actualMiddle.placement,expectedMiddle.placement);
  const carrierRecipe=carrierBodyShape(layout,0);
  if(carrierRecipe.kind!=='subtract'||carrierRecipe.children.length!==4)throw new Error('Expected authored positive carrier, bore and two M3 cuts.');
  const tapSources=carrierRecipe.children.slice(2).map((tool,index)=>componentPython(libraries,[{component:detailComponent('tap-tool-'+index,'Actual carrier M3 cutter '+index,tool),label:'Actual carrier M3 cutter '+index,color:0x79909f,requireSingleSolid:true}]));
  const existingCase=oldCases.find((c:{mode:string})=>c.mode===mode);
  assert.ok(existingCase); assert.equal(base.python(parameters,'assembled'),existingCase.source);
  const name=stem+'-guided-'+mode+(mode==='full'?'-mixed':'-neutral');
  const script=mode==='simple'?generateScript(part,parameters,'assembled',undefined,undefined,mode):undefined;
  if(script)writeFileSync(resolve(directory,name+'.FCMacro'),script);
  return {mode,name,parameters,newSource:part.python(parameters,'assembled'),oldSource:existingCase.source,
   oldNativeFile:resolve(oldDirectory,existingCase.name+'.FCStd'),oldNativeSha256:sha(readFileSync(resolve(oldDirectory,existingCase.name+'.FCStd'))),
   oldCaseName:existingCase.name,oldCaseCodeSha256:sha(existingCase.script),
   simpleScript:script,dimensions:mode==='simple'?part.dimensions(parameters,'assembled'):undefined,
   carrierBodySource:componentPython(libraries,[{component:detailComponent('carrier-body-proof','Carrier body without follower pins',carrierBodyShape(layout,0)),label:'Carrier body without follower pins',color:0xc7a448,requireSingleSolid:true}]),
   carrierInvariantPositiveAndBore:carrierRecipe.children.slice(0,2),carrierTapSources:tapSources,
   constructiveMiddleUnion:{actualParameters:actualMiddle.parameters,placement:actualMiddle.placement,parametersSha256:sha(JSON.stringify(actualMiddle.parameters)),expectedParametersSha256:sha(JSON.stringify(expectedMiddle.parameters))},
   rootMetadata:{id:part.id,name:part.name,productRequirements:part.product.releaseRequirements,evidence:JSON.stringify(modelEvidence(part,parameters))},
   unchangedChannels:now.filter(p=>/^[abcd]-/.test(p.component.id)).length,
  };
 }));
 const guide=detailComponent('stationary-guide-proof','Actual stationary central guide',guideShape(layout));
 const guideSource=withGeometryMode('simple',()=>componentPython(libraries,[{component:guide,label:guide.name,color:0x79909f,requireSingleSolid:true}]));
 const files=withGeometryMode('full',()=>part.fabricationFiles!(part.defaults));
 for(const file of files)writeFileSync(resolve(directory,file.name),file.content);
 cases.push({variant,partId:part.id,layout,faces:centralGuideFaces(layout),guideLayout:centralGuideLayout(layout),guideSource,modes,
  oldDirectory,oldCasesPath,oldCasesSha256:sha(readFileSync(oldCasesPath)),oldAuditPath:resolve(oldDirectory,'native-report.json'),oldAuditSha256:sha(readFileSync(resolve(oldDirectory,'native-report.json'))),
  stockProofPath:resolve(oldDirectory,'channel/swept-stock.json'),stockProofSha256:sha(readFileSync(resolve(oldDirectory,'channel/swept-stock.json'))),
  fabricationFiles:files.map(f=>({id:f.id,name:f.name,sha256:sha(f.content)})),
 });
}
const capture={schemaVersion:1,sources,scriptSha256:sha(readFileSync('scripts/verify-tr8-central-guide.ts')),cases};
const path=resolve(directory,'captures.json');writeFileSync(path,JSON.stringify(capture));
console.log(JSON.stringify({path,sha256:sha(readFileSync(path)),variants:cases.length,modes:cases.reduce((sum,c)=>sum+c.modes.length,0)}));
