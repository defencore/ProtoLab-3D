import type {Parameters,FabricationFile} from '../../../core/types';
import {componentPython,type ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {actuatorNativeSource} from '../../tr8-compact-actuator/part';
import {nutPiece,shoulderScrewPiece} from '../../tr8-quad-twin-pin-actuator/part';
import previous,{cuttingProfiles as previousProfiles,machiningSchedule as previousSchedule} from '../../tr8-quad-twin-pin-mini-actuator/part';
import {profileDxf,profileSvg} from '../../tr8-quad-laser-guided-actuator/part';
import {frameProfiles,lighteningCircles,type DiscPattern,type LaserProfile} from './frame';
import {libraries} from './channel';
import {layout,motorFit,motorModel,motorRoll,motorSource,inheritedParameters} from './layout';
import {driveMotion,selectedDrive,threadLayout} from './drive';
export function cuttingProfiles(pattern:DiscPattern='lightened'):LaserProfile[] {
  return [...frameProfiles(true,pattern),previousProfiles().find(p=>p.id==='solid-crank')!];
}
export function machiningSchedule(pattern:DiscPattern='lightened',screwModel='tr8x8-p2') {
  const old=previousSchedule(pattern,'prom-smb');
  const p={screwModel},drive=selectedDrive(p),limit=driveMotion(p,20);
  return {...old,partId:'tr8-quad-surpass-actuator',discDiameter:70,diameterLimit:undefined,
    screw:{...old.screw,designation:drive.designation,pitch:drive.pitch,lead:drive.lead,starts:drive.starts,
      manufacturing:shoulderScrewPiece(0,drive.lead).component.manufacturing},
    nut:{...old.nut,thread:{designation:drive.designation,pitch:drive.pitch,lead:drive.lead,starts:drive.starts,includedAngle:drive.includedAngle},
      manufacturing:nutPiece(0,drive.lead).component.manufacturing},
    motion:{outputLimitsDegrees:[-20,20],totalNutTravel:2*limit.nutTravel,motorSweepDegrees:2*Math.abs(limit.motorRotation),
      neutralIdealTorqueRatio:driveMotion(p,0).idealTorqueRatio,limitIdealTorqueRatio:limit.idealTorqueRatio,
      torqueFormula:'M_out(theta) = eta * 2*pi*h/(lead*cos(theta)^2) * M_motor; h=10 mm; theta in radians; eta is the total mechanism efficiency.'},
    motor:{model:motorModel,quantity:4,source:motorSource,frontX:layout.motorFront,axesRadius:layout.screwPitchRadius,rollDegrees:motorRoll,...motorFit,
      mounting:'Two opposed M3 holes on the16 mm part of the16/19 mm cross. Verify allowable blind insertion depth on purchased motors.',
      drive:'Direct sensorless BLDC drive; external reversible controllers required.',cable:'Free cables, boots and connectors need separate routing space.'},
    coupling:{designation:'LF D14L22 Clamp Other hole',bores:[3.175,4],centreX:layout.couplingCentre,motorEngagement:7,screwEngagement:7,shoulderClearance:.4},
    channels:{screwAxisRadius:layout.screwPitchRadius,outputAxisRadius:layout.outputRadial,lever:layout.lever},
    columns:{pitchRadius:layout.postRadius,firstClockDegrees:layout.postClock,quantity:8,bodyLength:30},
    lightening:pattern==='lightened'?{holesPerDisc:4,motorHoleDiameter:13.5,motorHolePitchRadius:12.5,fixedEndHoleDiameter:10,fixedEndHolePitchRadius:21.8,
      bearingDiscPhaseOffsetDegrees:-.6,minimumNewHoleLigament:3,steelDensityGPerCm3:7.85,
      extraMassSavingFromPreviousLightenedG:4*Math.PI*(6.75**2-4**2+2*(5**2-3.5**2))*3*.00785,
      holes:Object.fromEntries((['motor','fixed','end'] as const).map(role=>[role,lighteningCircles(role)]))}:undefined,
    requirements:[
      'Use three Ø70×3 mm discs with central Ø5 bores. Channels move radially; use the new guide/cheek slots and bearing positions.',
      ...(pattern==='lightened'?['Lightening windows: four Ø13.5 on radius12.5 in the motor disc; four Ø10 on radius21.8 in each bearing disc. Follow the supplied clocks and retain the3 mm minimum new-window ligaments. These geometrical ligaments do not establish a load or stiffness rating.']:[]),
      'Use standard30 mm columns at radius30.5 mm and clock18+90n degrees. Standard M3×8 front/rear frame screws are retained; no countersinks are needed.',
      'The motor disc has Ø8.2 shaft/bearing clearance openings and Ø3.4 bolt holes. Use two opposed M3×5 screws per motor on the16 mm cross; nominal insertion is2 mm. Confirm permitted insertion on the actual motor.',
      'Specify purchased LF D14L22 clamp couplings with custom Ø3.175×4 bores. Confirm the supplied fit; do not use a3 mm motor bore or add a shaft sleeve.',
      'Move each coupling centre to X=-32.4 mm. Both7 mm hub bases are fully engaged. Shaft tips enter the open spider bore by0.4/0.6 mm, leaving7 mm between tips and0.4 mm to the screw shoulder; verify actual centre-bore clearance.',
      'Retain the approved50 mm screws, twin-trunnion nuts, closed cranks,29.95 mm output shafts, guide profiles and bearing stacks.',
      'Support screw thrust through opposed bearings/sleeves. Inspect axial float, coupling gaps and full independent±20° motion.',
      `Use ${drive.designation} screws and matching ${drive.starts===1?'single-start':'four-start'} nuts: pitch2 mm, lead${drive.lead} mm/revolution. Screw and nut selections must match.`,
      `Select reversible sensorless BLDC drives with controlled low-speed operation and travel limits for the${drive.lead} mm screw lead. No motor/controller/load performance rating is assigned.`,
    ]};
}
export function fabricationFiles(p:Parameters,pieces:ConfiguredPiece[]):FabricationFile[] {
  const pattern=p.discPattern as DiscPattern,drive=selectedDrive(p),stem='TR8-SURPASS-2845-70-'+pattern+'-TR8x'+drive.lead+'-P2',out:FabricationFile[]=[];
  const schedule=machiningSchedule(pattern,String(drive.model));
  const add=(id:string,label:string,type:string,suffix:string,content:string)=>out.push({id,label,description:label,type,name:stem+'-'+suffix,content});
  const profiles=cuttingProfiles(pattern);
  for(const profile of profiles) {
    add(profile.id+'-dxf',profile.label+' · DXF 1:1','application/dxf',profile.id+'.dxf',profileDxf(profile));
    add(profile.id+'-svg',profile.label+' · SVG 1:1','image/svg+xml',profile.id+'.svg',profileSvg(profile));
  }
  let i=0;
  const blanks=profiles.flatMap(profile=>Array.from({length:profile.quantity},()=>{
    const component=detailComponent('blank-'+(++i),profile.label,{kind:'transform',translation:[i*86,0,0],rotation:[0,0,0],child:profile.shape});
    return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
  }));
  const macro=`import FreeCAD as App, Part, math\ndoc=App.newDocument('Surpass70LaserBlanks')\n${componentPython(libraries,blanks)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Blank'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\n    if App.GuiUp: obj.ViewObject.ShapeColor=tuple(component_colors[i])\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`;
  add('laser-blanks','All 15 laser blanks · 2 and 3 mm stock','text/x-python','laser-blanks.FCMacro',macro);
  // The output shaft is independent of the selected working thread.
  const reuse=new Set(['shaft-native']);
  for(const file of previous.fabricationFiles!({...previous.defaults,...inheritedParameters,discPattern:pattern}))
    if(reuse.has(file.id))out.push({...file,name:file.name.replace(/^TR8-twin-pin-54-[a-z]+-prom/,stem)});
  const detailMacro=(name:string,items:ConfiguredPiece[])=>`import FreeCAD as App, Part, math\ndoc=App.newDocument(${JSON.stringify(name)})\n${actuatorNativeSource(items,0,threadLayout(p),libraries)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Detail'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\n    for key,value in component_metadata[i].items():\n        if isinstance(value,str):\n            obj.addProperty('App::PropertyString',key,'ProtoLab')\n            setattr(obj,key,value)\n    if App.GuiUp: obj.ViewObject.ShapeColor=tuple(component_colors[i])\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`;
  add('nut-native',`${drive.designation} one-piece twin-trunnion nut`,'text/x-python','nut.FCMacro',detailMacro('SurpassTR8Nut',[nutPiece(0,drive.lead)]));
  add('screw-native',`${drive.designation} screw · 50 mm · two retaining grooves`,'text/x-python','screw.FCMacro',detailMacro('SurpassTR8Screw',[shoulderScrewPiece(0,drive.lead)]));
  add('motion',`${drive.designation} motor motion and ideal torque ratio`,'text/csv;charset=utf-8','motion.csv',
    'Angle_deg,NutTravel_mm,ScrewRotation_deg,IdealTorqueRatio\n'+[-20,-10,0,10,20].map(angle=>{
      const m=driveMotion(p,angle);return [angle,m.nutTravel,m.motorRotation,m.idealTorqueRatio].join(',');
    }).join('\n')+'\n');
  add('cut-manifest','Ø70 sheet quantities and finishing operations','application/json','cut-manifest.json',JSON.stringify({
    units:'mm',scale:'1:1',discDiameter:70,centralBoreDiameter:5,discPattern:pattern,stockThicknesses:[2,3],
    physicalBlanks:15,onePieceNuts:4,onePieceCranks:4,screwModel:drive.model,thread:schedule.nut.thread,profiles:profiles.map(({shape:_shape,...profile})=>profile),
  },null,2)+'\n');
  add('machining','Surpass2845 mounting and selected TR8 machining schedule','application/json','machining.json',JSON.stringify(schedule,null,2)+'\n');
  const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  add('bom','Bought and manufactured component list','text/csv;charset=utf-8','components.csv',[
    ['ID','Component','Quantity','Supply','Designation','Material','Supplier URL'],
    ...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.supply,c.procurement?.designation,c.manufacturing?.material,c.procurement?.source]),
  ].map(row=>row.map(csv).join(',')).join('\n')+'\n');
  add('assembly','Surpass2845 direct-drive assembly instructions','text/plain;charset=utf-8','assembly.txt',[
    `${drive.designation} four-drive Surpass Hobby KK2845 3100KV · three Ø70×3 mm laser discs.`,
    ...schedule.requirements,
    'Use8 SMB MF105 2Z5×10×4 screw bearings,4 MF106 2Z6×10×3 outer-output bearings and4 MF63 2Z3×6×2.5 inner guide bearings.',
    'Screws retain26 mm of working thread and only two external DIN471 rings per drive. Keep the approved inner/outer thrust sleeves.',
    'Motor installation envelope is reconstructed analytically from the branded drawing:'+motorSource,
    'The shaft flat depth is unspecified, so a conservative round envelope is retained. Confirm motor blind thread depth; route phase leads, rear boots and connectors separately.',
    'Motor bodies remain fixed during motion. Nominal axial extent119 mm excludes free cables and external electronics.',
    'No output force, torque, speed or duty rating is assigned; qualify low-speed commutation, reversal, friction, braking and thermal behaviour with the selected drive.',
  ].join('\n')+'\n');
  return out;
}
