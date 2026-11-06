import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {withGeometryMode} from '../src/core/geometry-mode';
import {generateScript} from '../src/core/freecad';
import {actuatorNativeSource} from '../src/parts/tr8-compact-actuator/part';
import part,{pieces,libraries,channelPieces,framePieces,threadLayout} from '../src/parts/tr8-quad-faulhaber-actuator/part';
const out=resolve(process.argv[2]??'test-results/faulhaber-twin-pin');mkdirSync(out,{recursive:true});
const data:any={cases:[],locals:[]};
writeFileSync(resolve(out,'TR8-FAULHABER-6855-56.FCMacro'),withGeometryMode('full',()=>generateScript(part,part.defaults,'assembled',undefined,undefined,'full')));
for(const pattern of ['lightened','solid']) {
  const p={...part.defaults,discPattern:pattern},folder=resolve(out,pattern);mkdirSync(folder,{recursive:true});
  for(const file of part.fabricationFiles!(p))writeFileSync(resolve(folder,file.name),file.content);
  for(const mode of pattern==='lightened'?['simple','full'] as const:['simple'] as const) {
    const pose={...p,angleA:-20,angleB:20,angleC:7,angleD:-11};
    const path=resolve(folder,'assembly-'+mode+'.FCMacro');
    writeFileSync(path,withGeometryMode(mode,()=>generateScript(part,pose,'assembled',undefined,undefined,mode)));
    data.cases.push({pattern,mode,path,expected:115});
  }
}
for(const angle of [-20,-10,0,10,20])withGeometryMode('simple',()=>{
  const p={...part.defaults,angleA:angle,angleB:angle,angleC:angle,angleD:angle};
  data.locals.push({angle,source:part.python(p,'assembled'),
    changed:pieces(p).filter(r=>r.component.libraryId==='faulhaber-bx4'||r.component.id.includes('motor-mount-M2')||r.component.id.startsWith('frame-front-bolt-')||/^laser-.*-disc$/.test(r.component.id)).map(r=>r.component.id)});
});
data.frameSource=withGeometryMode('simple',()=>actuatorNativeSource(framePieces(),0,threadLayout,libraries));
data.localSource=withGeometryMode('simple',()=>actuatorNativeSource(channelPieces(part.defaults,0),0,threadLayout,libraries));
writeFileSync(resolve(out,'capture.json'),JSON.stringify(data));
console.log(JSON.stringify({out,cases:data.cases.length,poses:data.locals.length}));
