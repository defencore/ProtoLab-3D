import type { FabricationFile, Parameters } from '../../../core/types';
import type { ConfiguredPiece } from '../../../core/assembly/detail-instances';
import { componentPython } from '../../../core/assembly/detail-instances';
import { detailComponent } from '../../../core/component-recipes';
import { cncMachiningSchedule, centralGuideLayout, forkBlankShape, forkContours, libraries, nutTravel } from '../../tr8-quad-cnc-actuator/part';
import { laserLayout, frameLayout } from './layout';
import { laserProfiles, receiverSlots } from './frame';
import { centralGuidePiece } from './guide';
import { crankProfiles, crankAssemblyRequirements } from './crank';
import { profileDxf, profileSvg, profileBounds, type LaserProfile, type LaserEdge, type LaserPoint } from './profiles';

export function cuttingProfiles(p:Parameters):LaserProfile[] {
  if(p.crankConstruction==='laminated')return [...laserProfiles(),...crankProfiles(laserLayout)];
  const original=forkContours(laserLayout);
  const point=(center:LaserPoint,radius:number,angle:number):LaserPoint=>[center[0]+radius*Math.cos(angle),center[1]+radius*Math.sin(angle)];
  const convert=(edge:(typeof original.outer)[number]):LaserEdge=>edge.kind==='line'?edge:{...edge,from:point(edge.center,edge.radius,edge.start),to:point(edge.center,edge.radius,edge.end)};
  return [...laserProfiles(),{id:'solid-crank',label:'One-piece crank · 3 mm steel · shaft pilot before finishing',thickness:3,quantity:4,
    shape:forkBlankShape(laserLayout,true),circles:[original.bore],loops:[original.outer.map(convert),original.slot.map(convert)]}];
}

export function machiningSchedule(p:Parameters) {
  const {middleBody:_removed,requirements:_previous,linkage:_oldLinkage,...drive}=cncMachiningSchedule(laserLayout);
  return {...drive,partId:'tr8-quad-laser-guided-actuator',crankConstruction:p.crankConstruction,
    structuralFrame:{discThickness:3,discDiameter:64,discStations:frameLayout.plateStations,clearSpans:frameLayout.clearSpans,
      purchasedStandoffs:[{designation:'DREMEC 115x30',quantity:4},{designation:'DREMEC 215x30',quantity:4}],
      endBolts:{designation:'M3x8',quantity:8,nominalEngagement:5},bearingCheeks:{quantity:8,thickness:3,pilotDiameter:9.8,finishedDiameter:10.02},
      guideSockets:{size:8.1,rotation:45,plates:['fixed-disc','end-disc']},receiverSlots:receiverSlots()},
    centralGuide:{...centralGuideLayout(laserLayout),bodyShoulders:frameLayout.guideShoulders,
      tenonSize:8,tenonDepth:2.7,finishedAxialEnds:[-17.7,17.7],blankDiameter:32,blankLength:35.4,
      supply:'One separate milled steel part, captured by the two bearing discs'},
    crank:p.crankConstruction==='laminated'?{platesPerCrank:4,stack:[.5,2,.5],pinWindowHeight:2.02,
      shaftBoreLaserNominal:6.05,slotWidth:4.1,join:'Flush spot or laser welds; fixture and qualify distortion/strength',requirements:crankAssemblyRequirements}:
      {platesPerCrank:1,thickness:3,shaftPilotDiameter:5.8,shaftFinishedDiameter:6.05,crossPinDrillDiameter:2},
    requirements:[
      'The structural frame requires milling only for the separate central guide. The original turned screws, output shafts, sleeves and machined nut carriers remain necessary.',
      'Laser cut all sheet profiles with kerf compensation; deburr. Finish eight 12.8 mm main bearing pilots and eight 9.8 mm cheek pilots to their assigned fits.',
      'Fit the square guide keys and centred cheek tabs; actual laser corners and sheet thickness require a production fit decision.',
      'Inspect the 5 mm M3 engagements in the source-qualified 10 mm female bores. The male standoff studs cross the 3 mm middle disc.',
      'Verify tab bearing stress, frame stiffness, guide reaction loads, running clearance and lubrication.',
      'The laminated fork requires joining and inspection, even though it removes crank cross-drilling. Do not leave the four plates loose.',
    ]};
}

export function fabricationFiles(p:Parameters,pieces:ConfiguredPiece[]):FabricationFile[] {
  const stem='TR8-laser-guided-64-'+String(p.crankConstruction);
  const profiles=cuttingProfiles(p),out:FabricationFile[]=[];
  const add=(id:string,label:string,type:string,name:string,content:string)=>out.push({id,label,description:label,type,name,content});
  for(const profile of profiles) {
    const name=`${stem}-${profile.id}-${profile.thickness}mm`;
    add(profile.id+'-dxf',profile.label+' · DXF 1:1','application/dxf',name+'.dxf',profileDxf(profile));
    add(profile.id+'-svg',profile.label+' · SVG 1:1','image/svg+xml',name+'.svg',profileSvg(profile));
  }
  const blanks:ConfiguredPiece[]=[];
  let row=0;
  for(const thickness of [...new Set(profiles.map(profile=>profile.thickness))].sort((a,b)=>a-b)) {
    let cursor=0;
    for(const profile of profiles.filter(profile=>profile.thickness===thickness)) {
      const [left,bottom,right]=profileBounds(profile);
      for(let n=0;n<profile.quantity;n++) {
        const component=detailComponent(`${profile.id}-blank-${n+1}`,profile.label+` · blank ${n+1}`,{
          kind:'transform',translation:[cursor-left,row*80-bottom,0],rotation:[0,0,0],child:profile.shape,
        });
        blanks.push({component,label:component.name,color:0x79909f,requireSingleSolid:true});
        cursor+=right-left+5;
      }
    }
    row++;
  }
  add('laser-blanks','All selected laser blanks · grouped by stock thickness','text/x-python',stem+'-laser-blanks.FCMacro',
    `import FreeCAD as App, Part, math\ndoc=App.newDocument('LaserGuidedBlanks')\n${componentPython(libraries,blanks)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Blank'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`);
  const guide=centralGuidePiece();
  add('central-guide-native','Separate milled central guide · with locating tenons','text/x-python',stem+'-central-guide.FCMacro',
    `import FreeCAD as App, Part, math\ndoc=App.newDocument('LaserFrameCentralGuide')\n${componentPython(libraries,[guide])}\nobj=doc.addObject('Part::Feature','CentralGuide')\nobj.Label=${JSON.stringify(guide.label)}\nobj.Shape=shape\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    obj.ViewObject.ShapeColor=tuple(component_colors[0])\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`);
  add('cut-manifest','Laser stock, quantities and finishing operations','application/json',stem+'-cut-manifest.json',JSON.stringify({units:'mm',scale:'1:1',construction:p.crankConstruction,
    mainDiscs:3,bearingCheeks:8,separateMilledGuides:1,profiles:profiles.map(({shape:_shape,...profile})=>profile),
    physicalLaserBlanks:blanks.length,stockThicknesses:[...new Set(profiles.map(profile=>profile.thickness))].sort((a,b)=>a-b),
    finishing:{screwBearingPilots:'12.8 to assigned 13.02 mm model fit',cheekPilots:'9.8 to assigned 10.02 mm model fit'},
  },null,2)+'\n');
  add('machining','Turning, frame fitting and guide machining schedule','application/json',stem+'-machining.json',JSON.stringify(machiningSchedule(p),null,2)+'\n');
  const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  add('bom','Selected bought and manufactured component list','text/csv;charset=utf-8',stem+'-components.csv',[
    ['ID','Component','Quantity','Library','Supply','Designation','Material'],
    ...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.libraryId,c.supply,c.procurement?.designation,c.manufacturing?.material]),
  ].map(row=>row.map(csv).join(',')).join('\n')+'\n');
  add('assembly','Frame and selected crank assembly instructions','text/plain;charset=utf-8',stem+'-assembly.txt',[
    'Fit the four female/female 30 mm columns to the motor disc with M3x8 bolts.',
    'Install screw bearings, shafts and drives; fit the separate guide rear square tenon and all bearing-cheek rear tabs in the middle disc.',
    'Thread the four male/female 30 mm standoffs through the middle disc into the first columns; each nominal M3 engagement is 5 mm.',
    'Seat the eight flanged output bearings in their finished 3 mm cheeks. Assemble shafts, sleeves and retaining rings in the existing order.',
    ...(p.crankConstruction==='laminated'?crankAssemblyRequirements:['Match-drill the solid crank and output shaft, then press the 2x10 pin.']),
    'Engage all front tabs and the guide square tenon in the end disc; fit its four M3x8 bolts. Check seating, free motion and alignment before tightening.',
    'The end-disc fasteners retain the guide and all tabbed supports. Do not add adhesive or weld the tab joints without a separately qualified manufacturing plan.',
  ].join('\n')+'\n');
  add('motion','Per-channel motion table','text/csv;charset=utf-8',stem+'-motion.csv','Angle_deg,NutTravel_mm,ScrewRotation_deg\n'+[-20,-10,0,10,20].map(angle=>[angle,nutTravel(laserLayout,angle),-360*nutTravel(laserLayout,angle)/8].join(',')).join('\n')+'\n');
  return out;
}
