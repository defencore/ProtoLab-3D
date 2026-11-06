/** Bind the actual fabrication API to independently parsed DXF/SVG/native blanks. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import part from '../src/parts/tr8-quad-mini-actuator/part';
import { sharedPlates, sharedPlateNativeSource } from '../src/parts/tr8-quad-mini-actuator/lib/shared-plates';
import { bearingCheeks, bearingCheekBlankShape } from '../src/parts/tr8-quad-mini-actuator/lib/bearing-cheeks';
import { forkBlankShape, forkSheetThickness } from '../src/parts/tr8-quad-mini-actuator/lib/nut-linkage';
import { channels } from '../src/parts/tr8-quad-mini-actuator/lib/placement';
import { frameLayout, mechanismLayout } from '../src/parts/tr8-quad-mini-actuator/lib/layout';
import { pythonShape } from '../src/core/assembly/boundary/shapes';
import profiles from '../src/parts/tr8-quad-mini-actuator/lib/laser-profiles.json';
const directory=resolve(process.argv[2]??'test-results/tr8-quad-mini-actuator');mkdirSync(directory,{recursive:true});
const files=part.fabricationFiles!(part.defaults).map(file=>{if(typeof file.content!=='string')throw new Error('Textual fabrication file required');writeFileSync(resolve(directory,file.name),file.content);return{name:file.name,sha256:createHash('sha256').update(file.content).digest('hex')};});
const analytical=[
 ...sharedPlates().map(p=>({id:p.id,kind:'main',quantity:1,thickness:p.thickness,flatCutSource:sharedPlateNativeSource(p,'cut',true),nativePlacements:[{name:p.id.replaceAll('-','_'),chain:[p.placement]}]})),
 ...bearingCheeks().map(p=>({id:p.id,kind:'cheek',quantity:1,thickness:p.thickness,sheetLowY:p.sheetLowY,flatCutSource:'shape=('+pythonShape(bearingCheekBlankShape(p,true))+').removeSplitter()',nativePlacements:[{name:p.id.replaceAll('-','_'),chain:[p.placement]}]})),
 {id:'pinned-fork',kind:'fork',quantity:8,thickness:forkSheetThickness,flatCutSource:'shape=('+pythonShape(forkBlankShape())+').removeSplitter()',nativePlacements:channels(part.defaults).flatMap(c=>[false,true].map(positive=>({name:c.id+(positive?'_rear':'_front')+'_fork_blank',chain:[{translation:c.origin,rotation:[c.clock,0,0]},{translation:[mechanismLayout.outputX,positive?mechanismLayout.coverHalfWidth+.05+forkSheetThickness:-mechanismLayout.coverHalfWidth-.05,0],rotation:[90,0,0]}]})))}
];
if(files.length!==31||new Set(files.map(f=>f.name)).size!==31)throw new Error('Exactly31 unique fabrication files required');
writeFileSync(resolve(directory,'fabrication-expectations.json'),JSON.stringify({partId:part.id,frame:frameLayout,signature:profiles.signature,bomOccurrenceCount:part.composition!(part.defaults).components.length,files,analytical},null,2));
console.log(JSON.stringify({files:files.length,profiles:analytical.length,directory}));
