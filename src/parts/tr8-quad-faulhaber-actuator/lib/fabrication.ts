import type {Parameters,FabricationFile} from '../../../core/types';
import {componentPython,type ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import previous,{cuttingProfiles as previousProfiles,machiningSchedule as previousSchedule} from '../../tr8-quad-twin-pin-mini-actuator/part';
import {profileDxf,profileSvg} from '../../tr8-quad-laser-guided-actuator/part';
import {frameProfiles,lighteningCircles,type DiscPattern,type LaserProfile} from './frame';
import {libraries} from './channel';
import {layout,motorFit,motorModel,motorRoll,motorSource,inheritedParameters} from './layout';
export function cuttingProfiles(pattern:DiscPattern='lightened'):LaserProfile[] {
  return [...frameProfiles(true,pattern),previousProfiles().find(p=>p.id==='solid-crank')!];
}
export function machiningSchedule(pattern:DiscPattern='lightened') {
  const old=previousSchedule(pattern,'prom-smb');
  return {...old,partId:'tr8-quad-faulhaber-actuator',discDiameter:56,diameterLimit:undefined,
    motor:{model:motorModel,quantity:4,source:motorSource,frontX:layout.motorFront,axesRadius:16,rollDegrees:motorRoll,...motorFit,
      mounting:'Two opposed M2 holes of the six-hole Ø17 pattern; exact supplier bores retain the Ø1.6 tap-drill representation.',
      drive:'Direct BLDC drive; no reduction stage. External Hall-compatible controllers required.',
      cable:'Route the free175 mm ribbons separately; only supplier cable roots appear in the CAD.'},
    lightening:pattern==='lightened'?{holesPerDisc:4,motorHoleDiameter:6.4,motorHolePitchRadius:10,fixedEndHoleDiameter:5.4,
      holes:Object.fromEntries((['motor','fixed','end'] as const).map(role=>[role,lighteningCircles(role)]))}:undefined,
    requirements:[
      'Use three Ø56×3 mm discs. All have a central Ø5 bore. Existing guide/cheek tabs and column positions are unchanged.',
      'Countersink the four motor-disc column holes from the motor side: Ø6.2 mouth with0.25 mm rim,90° cone to Ø3.4 at1.65 mm depth. Use four M3×8 DIN7991 screws, heads flush at X=-51. Assemble these before the motors.',
      'Finish motor pilot bores Ø9.8 to Ø10.1 mm. Use eight M2×5 socket screws, two per motor;2 mm engagement within3 mm blind threads.',
      'The manufacturer CAD has Ø1.6 plain tap-drill bores for M2. Expected screw-thread engagement intersects those simplified bores; no internal thread geometry has been fabricated.',
      'Clock all four motor cable roots tangentially in the same pinwheel direction. Keep free cables clear of the coupling and all moving parts.',
      'Retain the approved screw/nut/crank, guide and output-bearing datums. Inspect complete independent±20° travel.',
      'Support screw thrust through the opposed bearings and sleeves, not through the motor. Verify axial float and coupling gaps with actual parts.',
      'Select four24 V BLDC controllers compatible with digital Hall sensors. Set velocity and end stops for the8 mm screw lead; the gearbox control settings do not apply.',
    ]};
}
export function fabricationFiles(p:Parameters,pieces:ConfiguredPiece[]):FabricationFile[] {
  const pattern=p.discPattern as DiscPattern,stem='TR8-FAULHABER-6855-56-'+pattern,out:FabricationFile[]=[];
  const add=(id:string,label:string,type:string,suffix:string,content:string)=>out.push({id,label,description:label,type,name:stem+'-'+suffix,content});
  const profiles=cuttingProfiles(pattern);
  for(const profile of profiles) {
    add(profile.id+'-dxf',profile.label+' · DXF 1:1','application/dxf',profile.id+'.dxf',profileDxf(profile));
    add(profile.id+'-svg',profile.label+' · SVG 1:1','image/svg+xml',profile.id+'.svg',profileSvg(profile));
  }
  let i=0;
  const blanks=profiles.flatMap(profile=>Array.from({length:profile.quantity},()=>{
    const component=detailComponent('blank-'+(++i),profile.label,{kind:'transform',translation:[i*70,0,0],rotation:[0,0,0],child:profile.shape});
    return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
  }));
  const macro=`import FreeCAD as App, Part, math\ndoc=App.newDocument('Faulhaber56LaserBlanks')\n${componentPython(libraries,blanks)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Blank'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\n    if App.GuiUp: obj.ViewObject.ShapeColor=tuple(component_colors[i])\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`;
  add('laser-blanks','All 15 laser blanks · 2 and 3 mm stock','text/x-python','laser-blanks.FCMacro',macro);
  // These fabricated details retain the approved geometry and manufacturing recipe.
  const reuse=new Set(['nut-native','shaft-native','screw-native','motion']);
  for(const file of previous.fabricationFiles!({...previous.defaults,...inheritedParameters,discPattern:pattern}))
    if(reuse.has(file.id))out.push({...file,name:file.name.replace(/^TR8-twin-pin-54-[a-z]+-prom/,stem)});
  add('cut-manifest','Ø56 sheet quantities and finishing operations','application/json','cut-manifest.json',JSON.stringify({
    units:'mm',scale:'1:1',discDiameter:56,centralBoreDiameter:5,discPattern:pattern,stockThicknesses:[2,3],
    physicalBlanks:15,onePieceNuts:4,onePieceCranks:4,profiles:profiles.map(({shape:_shape,...profile})=>profile),
  },null,2)+'\n');
  add('machining','FAULHABER mounting and retained TR8 machining schedule','application/json','machining.json',JSON.stringify(machiningSchedule(pattern),null,2)+'\n');
  const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  add('bom','Bought and manufactured component list','text/csv;charset=utf-8','components.csv',[
    ['ID','Component','Quantity','Supply','Designation','Material','Supplier URL'],
    ...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.supply,c.procurement?.designation,c.manufacturing?.material,c.procurement?.source]),
  ].map(row=>row.map(csv).join(',')).join('\n')+'\n');
  add('assembly','FAULHABER direct-drive assembly instructions','text/plain;charset=utf-8','assembly.txt',[
    'TR8 four-drive FAULHABER2250S024BX4 6855 ·24 V · three Ø56×3 mm laser discs.',
    ...machiningSchedule(pattern).requirements,
    'Use8 SMB MF105 2Z5×10×4 screw bearings,4 MF106 2Z6×10×3 outer-output bearings and4 MF63 2Z3×6×2.5 inner guide bearings.',
    'Screws finish at50 mm with26 mm of working TR8×8(P2) thread. Fit only two external DIN471 screw rings per drive and the retained inner/outer thrust sleeves.',
    'Output shafts finish at29.95 mm; the bearing span is17.7 mm. Keep the guide keys, one-piece twin-pin brass nuts and closed-slot cranks unchanged.',
    'Supplier STEP SHA-256:6b45e62b98198243e0b174761c382a56ced7a54dc219587f902a8f222071f6a8. Exact motor product:'+motorSource,
    'Motor bodies do not turn with the animation. Nominal block axial extent126.8 mm excludes free cable runs and external electronics.',
    'No output force/speed/load rating is assigned; qualify low-speed control, acceleration, friction, braking and thermal duty for the actual application.',
  ].join('\n')+'\n');
  return out;
}
