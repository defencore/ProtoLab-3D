import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {withGeometryMode} from '../src/core/geometry-mode';
import {generateScript} from '../src/core/freecad';
import {componentPython} from '../src/core/assembly/detail-instances';
import {actuatorNativeSource} from '../src/parts/tr8-compact-actuator/part';
import {promActuatorBearings} from '../src/parts/flanged-ball-bearing/part';
import small,{channelPieces as smallChannel,framePieces as smallFrame,threadLayout,libraries,layout as smallLayout} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import large,{channelPieces as largeChannel,framePieces as largeFrame,layout as largeLayout} from '../src/parts/tr8-quad-twin-pin-actuator/part';
import {cncChannels,placeCncPiece} from '../src/parts/tr8-quad-cnc-actuator/part';
const out=resolve(process.argv[2]??'test-results/prom-bearing-kit');mkdirSync(out,{recursive:true});
const data:any={priorScrewSources:[],cases:[],locals:[],bearings:promActuatorBearings.map(p=>({designation:p.name,parameters:p.parameters,source:p.catalog!.sourceUrl,checked:'2026-10-29',quantity:p.id==='smb-mf105-2z'?8:4}))};
for(const [part,channel,frame,l] of [[small,smallChannel,(kit:any)=>smallFrame('lightened',kit),smallLayout],[large,largeChannel,largeFrame,largeLayout]] as const) {
  withGeometryMode('simple',()=>data.priorScrewSources.push({part:part.id,source:actuatorNativeSource(channel({...part.defaults,bearingKit:'reference'},0),0,threadLayout,libraries)}));
  for(const kit of ['prom-smb','reference'] as const)for(const mode of kit==='reference'?['simple'] as const:['simple','full'] as const)withGeometryMode(mode,()=>{
    const p={...part.defaults,bearingKit:kit,angleA:-20,angleB:20,angleC:-20,angleD:20};
    const name=part.id+'-'+kit+'-'+mode,path=resolve(out,name+'.FCMacro');
    writeFileSync(path,generateScript(part,p,'assembled',undefined,undefined,mode));
    data.cases.push({name,path,kit,mode,part:part.id,expected:part.composition!(p).components.length});
  });
  for(const angle of [-20,-10,0,10,20])withGeometryMode('simple',()=>{
    const p={...part.defaults,bearingKit:'prom-smb'},rows=channel(p,angle);
    data.locals.push({part:part.id,angle,source:actuatorNativeSource(rows,10*Math.tan(angle*Math.PI/180),threadLayout,libraries),
      changed:rows.filter(r=>r.component.id==='lead-screw'||r.component.libraryId==='flanged-ball-bearing'||/^(fixed|floating)-(inner|outer)-spacer$/.test(r.component.id)).map(r=>r.component.id),
      frameSource:angle===0?actuatorNativeSource(frame('prom-smb'),0,threadLayout,libraries):undefined,
      placedSources:angle===0?cncChannels(p,'assembled',l).map(c=>({id:c.id,ids:rows.map(r=>r.component.id),source:componentPython(libraries,rows.map(r=>placeCncPiece(r,c)))})):undefined});
  });
  for(const pattern of part.id===small.id?['lightened','solid']:['solid']) {
    const p={...part.defaults,bearingKit:'prom-smb',...(part.id===small.id?{discPattern:pattern}:{})};
    const dir=resolve(out,part.id+'-'+pattern);mkdirSync(dir,{recursive:true});
    for(const file of part.fabricationFiles!(p))writeFileSync(resolve(dir,file.name),file.content);
    writeFileSync(resolve(dir,'assembly.FCMacro'),withGeometryMode('full',()=>generateScript(part,p,'assembled',undefined,undefined,'full')));
  }
}
writeFileSync(resolve(out,'capture.json'),JSON.stringify(data));
writeFileSync(resolve(out,'bearings-order.csv'),'Designation,Quantity per block,Dimensions mm,Supplier URL,Availability checked\n'+data.bearings.map((b:any)=>[b.designation,b.quantity,`${b.parameters.bore}x${b.parameters.outer}x${b.parameters.width}`,b.source,b.checked].join(',')).join('\n')+'\n');
console.log(JSON.stringify({cases:data.cases.length,localPoses:data.locals.length,out}));
