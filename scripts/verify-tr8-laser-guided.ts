/** Freeze actual new public APIs for bounded, source-bound native delta checks. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { componentPython } from '../src/core/assembly/detail-instances';
import { detailComponent } from '../src/core/component-recipes';
import { generateScript } from '../src/core/freecad';
import { withGeometryMode } from '../src/core/geometry-mode';
import part,{laserPieces,laserChannelPieces,laserFramePieces,layout,centralGuideShape,libraries} from '../src/parts/tr8-quad-laser-guided-actuator/part';
import { cuttingProfiles } from '../src/parts/tr8-quad-laser-guided-actuator/lib/fabrication';
import { laserProfiles } from '../src/parts/tr8-quad-laser-guided-actuator/lib/frame';
import { crankPieces } from '../src/parts/tr8-quad-laser-guided-actuator/lib/crank';
import { channelPieces,cncLayout,cncChannels,centralGuideFaces,centralGuideLayout,carrierBodyShape,nativeThreadLayout,nutTravel } from '../src/parts/tr8-quad-cnc-actuator/part';
import { actuatorNativeSource } from '../src/parts/tr8-compact-actuator/part';
import preserved from '../tests/fixtures/tr8-sfk-before-laser-source-sha256.json';

const directory=resolve(process.argv[2]??'test-results/tr8-laser-guided/validation');
mkdirSync(directory,{recursive:true});
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const binding=(path:string)=>({path:resolve(path),sha256:sha(readFileSync(path))});
const walk=(path:string):string[]=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path+'/'+entry.name):[path+'/'+entry.name]);
for(const [family,files] of Object.entries(preserved))for(const [file,checksum] of Object.entries(files))assert.equal(sha(readFileSync(`src/parts/${family}/${file}`)),checksum);
const sourceFiles=[...walk('src/parts/tr8-quad-laser-guided-actuator'),
 ...Object.entries(preserved).flatMap(([family,files])=>Object.keys(files).map(file=>`src/parts/${family}/${file}`)),
 'src/core/freecad.ts','src/core/freecad-appearance.ts','src/core/assembly/detail-instances.ts',
 'scripts/tr8_cnc_cross_stock.py','scripts/tr8_cross_stock.py','scripts/verify-tr8-cnc-fabrication.py',
];
const mixed={angleA:-20,angleB:20,angleC:-20,angleD:20};
const inheritedCases=JSON.parse(readFileSync('test-results/tr8-quad-cnc-actuator/channel/cases.json','utf8'));
const cases=([
 {mode:'simple',construction:'laminated',angles:{angleA:0,angleB:0,angleC:0,angleD:0},suffix:'neutral'},
 {mode:'full',construction:'laminated',angles:mixed,suffix:'mixed'},
 {mode:'simple',construction:'solid',angles:mixed,suffix:'mixed'},
] as const).map(spec=>withGeometryMode(spec.mode,()=>{
 const parameters={...part.defaults,...spec.angles,crankConstruction:spec.construction};
 assert.deepEqual(part.validate(parameters,'assembled'),[]);
 const pieces=laserPieces(parameters),name=`laser64-${spec.mode}-${spec.construction}-${spec.suffix}`;
 const unchanged=[];
 for(const angle of [-20,0,20]) {
  const old=channelPieces(parameters,angle,cncLayout('coplanar-64'));
  const now=laserChannelPieces(parameters,angle);
  const audited=inheritedCases.find((entry:{parameters:{outputAngle:number}})=>entry.parameters.outputAngle===angle);
  assert.ok(audited);
  const auditedSource=spec.mode==='full'?audited.source:audited.nominalSource;
  const currentOldSource=actuatorNativeSource(old,nutTravel(layout,angle),nativeThreadLayout(layout),libraries);
  assert.equal(currentOldSource,auditedSource,'Old native channel source no longer matches the inherited audit');
  const noCrank=(id:string)=>id!=='output-rear-crank'&&!id.startsWith('output-crank-');
  assert.deepEqual(now.filter(p=>noCrank(p.component.id)),old.filter(p=>noCrank(p.component.id)));
  unchanged.push({angle,occurrences:old.filter(p=>noCrank(p.component.id)).length,sha256:sha(JSON.stringify(old.filter(p=>noCrank(p.component.id)))),
   inheritedNativeSourceSha256:sha(currentOldSource),inheritedNativeSourceExactMatch:true});
 }
 const source=part.python(parameters,'assembled'),script=generateScript(part,parameters,'assembled',undefined,undefined,spec.mode);
 writeFileSync(resolve(directory,name+'.FCMacro'),script);
 return {name,mode:spec.mode,construction:spec.construction,parameters,source,scriptSha256:sha(script),
  dimensions:part.dimensions(parameters,'assembled'),components:pieces.map(p=>p.component),
  mounts:cncChannels(parameters,'assembled',layout),unchanged,
  expectedConfigurations:spec.construction==='laminated'?152:140};
}));
const profiles=cuttingProfiles(part.defaults);
const crankEvidence=JSON.parse(readFileSync('test-results/tr8-laser-guided/crank/captures.json','utf8'));
for(const proof of crankEvidence.cases)assert.equal(withGeometryMode('simple',()=>componentPython(libraries,crankPieces(layout,proof.angle))),proof.source,'Current crank API differs from the native subset/pin proof');
const fabrication=withGeometryMode('full',()=>part.fabricationFiles!(part.defaults));
for(const file of fabrication)writeFileSync(resolve(directory,file.name),file.content);
const flatSource=(id:string,shape:Parameters<typeof detailComponent>[2])=>componentPython(libraries,[{component:detailComponent(id,id,shape),label:id,color:0x79909f,requireSingleSolid:true}]);
const profileRows=profiles.map(profile=>({id:profile.id,quantity:profile.quantity,thickness:profile.thickness,
 source:withGeometryMode('simple',()=>flatSource(profile.id,profile.shape)),
 dxf:binding(resolve(directory,fabrication.find(file=>file.id===profile.id+'-dxf')!.name)),
 svg:binding(resolve(directory,fabrication.find(file=>file.id===profile.id+'-svg')!.name)),
 finishedSource:profile.id.includes('disc')||profile.id==='output-bearing-cheek'
  ?withGeometryMode('simple',()=>flatSource(profile.id+'-finished',laserProfiles(false).find(p=>p.id===profile.id)!.shape)):undefined,
}));
const oldDirectory=resolve('test-results/tr8-quad-cnc-actuator');
const references=[
 'test-results/tr8-quad-cnc-actuator/native-report.json',
 'test-results/tr8-quad-cnc-actuator/channel/swept-stock.json',
 'test-results/tr8-quad-cnc-actuator/channel/cases.json',
 'test-results/tr8-quad-cnc-actuator/channel/native-report.json',
 'test-results/tr8-central-guide/validation/native-report.json',
 'test-results/tr8-central-guide/review/independent-roll-report.json',
 'test-results/tr8-laser-guided/frame/captures.json',
 'test-results/tr8-laser-guided/frame/report.json',
 'test-results/tr8-laser-guided/frame/probe.py',
 'test-results/tr8-laser-guided/crank/captures.json',
 'test-results/tr8-laser-guided/crank/native-report.json',
 'test-results/tr8-laser-guided/crank/prove.py',
].map(binding);
const capture={schemaVersion:1,partId:part.id,directory,layout,sources:sourceFiles.map(binding),
 captureScript:binding('scripts/verify-tr8-laser-guided.ts'),preservedSource:preserved,
 cases,profiles:profileRows,frameSource:withGeometryMode('simple',()=>componentPython(libraries,laserFramePieces())),
 guideSource:withGeometryMode('simple',()=>flatSource('central-guide',centralGuideShape())),
 carrierBodySource:withGeometryMode('simple',()=>flatSource('carrier-body',carrierBodyShape(layout,0))),
 guideFaces:centralGuideFaces(layout),guideLayout:centralGuideLayout(layout),
 references,oldDirectory,
 fabricationFiles:fabrication.map(file=>({id:file.id,name:file.name,...binding(resolve(directory,file.name))})),
};
const file=resolve(directory,'captures.json');writeFileSync(file,JSON.stringify(capture));
console.log(JSON.stringify({file,cases:cases.length,profiles:profiles.length,sourceHashes:capture.sources.length}));
