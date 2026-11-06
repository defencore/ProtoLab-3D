import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {componentPython} from '../src/core/assembly/detail-instances';
import {detailComponent} from '../src/core/component-recipes';
import {generateScript} from '../src/core/freecad';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{pieces,layout,twinPin,channelPieces,framePieces,frameProfiles,guideProfile,nutShape,shaftShape,cuttingProfiles,libraries,threadLayout,diameterLimit,compact,lighteningCircles} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import {channelPieces as oldChannel,cncChannels,nutTravel,nativeThreadLayout} from '../src/parts/tr8-quad-cnc-actuator/part';
import {layout as approvedLayout,framePieces as approvedFrame} from '../src/parts/tr8-quad-twin-pin-actuator/part';
import {actuatorNativeSource} from '../src/parts/tr8-compact-actuator/part';

const directory=resolve(process.argv[2]??'test-results/tr8-twin-pin-mini/validation');mkdirSync(directory,{recursive:true});
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const binding=(path:string)=>({path:resolve(path),sha256:sha(readFileSync(path))});
const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path+'/'+entry.name):[path+'/'+entry.name]);
const preserved=JSON.parse(readFileSync('test-results/tr8-twin-pin-mini/preserved-source.json','utf8')) as Record<string,string>;
for(const [path,hash] of Object.entries(preserved))assert.equal(sha(readFileSync(path)),hash);
const source=(id:string,shape:Parameters<typeof detailComponent>[2])=>componentPython(libraries,[{component:detailComponent(id,id,shape),label:id,color:0xc7a448,requireSingleSolid:true}]);
const poses=[-20,-10,0,10,20];
const baselineLayout=approvedLayout;
const changedIds=['lead-nut','output-shaft','output-bearing-1','output-spacer','output-circlip-1'];
const unchangedIds=channelPieces(part.defaults,0).map(p=>p.component.id).filter(id=>oldChannel(part.defaults,0,baselineLayout).some(p=>p.component.id===id)&&!changedIds.includes(id));
for(const mode of ['simple','full'] as const)for(const angle of [-20,0,20])withGeometryMode(mode,()=>{
  const old=oldChannel(part.defaults,angle,baselineLayout),now=channelPieces(part.defaults,angle);
  for(const id of unchangedIds)assert.deepEqual(now.find(p=>p.component.id===id),old.find(p=>p.component.id===id),id);
  assert.deepEqual(now.find(p=>p.component.id==='output-crank')!.component.parameters,old.find(p=>p.component.id==='output-rear-crank')!.component.parameters);
});
const local=withGeometryMode('simple',()=>poses.map(angle=>({angle,source:actuatorNativeSource(channelPieces(part.defaults,angle),nutTravel(layout,angle),threadLayout,libraries)})));
const profiles=withGeometryMode('simple',()=>cuttingProfiles());
const fabrication=withGeometryMode('full',()=>part.fabricationFiles!(part.defaults));
for(const file of fabrication)writeFileSync(resolve(directory,file.name),file.content);
const profileRows=profiles.map(p=>({id:p.id,thickness:p.thickness,quantity:p.quantity,source:source(p.id,p.shape),
  solidFinishedSource:p.id.endsWith('-disc')?source(p.id+'-solid-finished',frameProfiles(false,'solid').find(f=>f.id===p.id)!.shape):undefined,
  solidSource:p.id.endsWith('-disc')?source(p.id+'-solid',frameProfiles(true,'solid').find(f=>f.id===p.id)!.shape):undefined,
  relief:p.id.endsWith('-disc')?lighteningCircles(p.id.slice(0,-5) as 'motor'|'fixed'|'end'):undefined,
  finishedSource:p.id==='solid-crank'?undefined:source(p.id+'-finished',frameProfiles(false).find(f=>f.id===p.id)!.shape),
  dxf:binding(resolve(directory,fabrication.find(f=>f.id===p.id+'-dxf')!.name)),svg:binding(resolve(directory,fabrication.find(f=>f.id===p.id+'-svg')!.name))}));
const cases=([{mode:'simple',state:'assembled',pattern:'lightened',angles:[0,0,0,0]},
  {mode:'full',state:'assembled',pattern:'lightened',angles:[-20,20,-20,20]},
  {mode:'simple',state:'assembled',pattern:'solid',angles:[0,0,0,0]}] as const).map(c=>withGeometryMode(c.mode,()=>{
  const parameters={...part.defaults,discPattern:c.pattern,angleA:c.angles[0],angleB:c.angles[1],angleC:c.angles[2],angleD:c.angles[3]};
  assert.deepEqual(part.validate(parameters,c.state),[]);
  const name='twin54-'+c.mode+'-'+c.pattern,script=generateScript(part,parameters,c.state,undefined,undefined,c.mode);
  writeFileSync(resolve(directory,name+'.FCMacro'),script);
  return {...c,name,parameters,scriptSha256:sha(script),expectedConfigurations:pieces(parameters,c.state).length,
    dimensions:part.dimensions(parameters,c.state),mounts:cncChannels(parameters,c.state,layout)};
}));
const guide=guideProfile(false);
const hardwareTranslations=framePieces().filter(p=>p.component.libraryId==='pcb-standoff'||p.component.libraryId==='bolt-screw').map(p=>{
 const old=approvedFrame().find(o=>o.component.id===p.component.id)!;assert.deepEqual(p.component.parameters,old.component.parameters);
 p.component.placement.rotation.forEach((v,i)=>assert.ok(Math.abs(v-old.component.placement.rotation[i])<1e-8));
 return {id:p.component.id,translation:p.component.placement.translation.map((v,i)=>v-old.component.placement.translation[i]),sourceParametersAndRotationUnchanged:true};
});
const capture={hardwareTranslations,layout,twinPin,compact,diameterLimit:diameterLimit(),threadLayout,unchangedIds,local,cases,profiles:profileRows,
  originalNativeSources:Object.fromEntries((['simple','full'] as const).map(mode=>[mode,withGeometryMode(mode,()=>actuatorNativeSource(oldChannel(part.defaults,0,baselineLayout),0,nativeThreadLayout(baselineLayout),libraries))])),
  frameSource:withGeometryMode('simple',()=>actuatorNativeSource(framePieces(),0,threadLayout,libraries)),
  guideSource:source('guide-flat',guide.shape),
  nutSources:withGeometryMode('simple',()=>poses.map(angle=>({angle,center:nutTravel(layout,angle),source:source('nut',nutShape(nutTravel(layout,angle)))}))),
  shaftSource:source('shaft',shaftShape(0)),
  mounts:cncChannels(part.defaults,'assembled',layout),
  sources:[...walk('src/parts/tr8-quad-twin-pin-mini-actuator'),...Object.keys(preserved),'scripts/verify-tr8-twin-pin-mini.ts',
    'src/core/freecad.ts','src/core/freecad-appearance.ts','src/core/assembly/detail-instances.ts'].map(binding),
  priorProofs:['test-results/tr8-quad-cnc-actuator/channel/swept-stock.json','test-results/tr8-quad-cnc-actuator/channel/cases.json',
    'test-results/tr8-quad-cnc-actuator/channel/native-report.json','test-results/tr8-laser-guided/validation/native-report.json','test-results/tr8-twin-pin/validation/native-report.json','test-results/tr8-twin-pin/validation/captures.json','test-results/tr8-laser-guided/frame/report.json','test-results/tr8-laser-guided/frame/captures.json'].map(binding),
  fabrication:fabrication.map(file=>({id:file.id,name:file.name,...binding(resolve(directory,file.name))})),preserved};
writeFileSync(resolve(directory,'captures.json'),JSON.stringify(capture));
console.log(JSON.stringify({directory,cases:cases.length,profiles:profiles.length,localPoses:local.length,configuredOccurrences:cases[0].expectedConfigurations}));
