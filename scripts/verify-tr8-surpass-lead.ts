import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {withGeometryMode} from '../src/core/geometry-mode';
import {generateScript} from '../src/core/freecad';
import {actuatorNativeSource} from '../src/parts/tr8-compact-actuator/part';
import part,{channelPieces,driveMotion,selectedDrive,threadLayout,libraries} from '../src/parts/tr8-quad-surpass-actuator/part';

const out=resolve(process.argv[2]??'test-results/tr8-selectable-screw');mkdirSync(out,{recursive:true});
const data:{pairs:unknown[];details:unknown[];assemblies:unknown[]}={pairs:[],details:[],assemblies:[]};
for(const screwModel of ['tr8x8-p2','tr8x2-p2']) {
  const p={...part.defaults,screwModel},drive=selectedDrive(p),folder=resolve(out,screwModel);mkdirSync(folder,{recursive:true});
  withGeometryMode('full',()=>{
    for(const angle of [-20,0,20]) {
      const m=driveMotion(p,angle),pieces=channelPieces(p,angle).filter(r=>['lead-screw','lead-nut'].includes(r.component.id));
      const path=resolve(folder,'pair-'+angle+'.py');
      writeFileSync(path,actuatorNativeSource(pieces,m.nutTravel,threadLayout(p),libraries));
      data.pairs.push({screwModel,lead:drive.lead,starts:drive.starts,angle,displacement:m.nutTravel,path});
    }
    for(const file of part.fabricationFiles!(p)) {
      const path=resolve(folder,file.name);writeFileSync(path,file.content);
      if(['nut-native','screw-native'].includes(file.id))data.details.push({screwModel,lead:drive.lead,starts:drive.starts,id:file.id,path});
    }
  });
  if(drive.lead===2)for(const mode of ['simple','full'] as const)withGeometryMode(mode,()=>{
    const pose={...p,angleA:-20,angleB:20,angleC:7,angleD:-11};
    const path=resolve(folder,'assembly-'+mode+'.FCMacro');
    writeFileSync(path,generateScript(part,pose,'assembled',undefined,undefined,mode));
    data.assemblies.push({screwModel,mode,path});
  });
}
writeFileSync(resolve(out,'lead-capture.json'),JSON.stringify(data,null,2)+'\n');
console.log(JSON.stringify({out,pairs:data.pairs.length,details:data.details.length,assemblies:data.assemblies.length}));
