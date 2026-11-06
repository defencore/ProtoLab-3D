import {bearingKit,type BearingKit,screwSleeves,shoulderScrewPiece} from './bearings';
import {promActuatorBearings} from '../../flanged-ball-bearing/part';
import type {Parameters,FabricationFile} from '../../../core/types';
import {componentPython,type ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {forkContours,forkBlankShape,libraries,cncMachiningSchedule,nutTravel} from '../../tr8-quad-cnc-actuator/part';
import {frameProfiles} from './frame';
import {layout,twinPin} from './layout';
import {nutPiece,shaftPiece} from './linkage';
import {profileDxf,profileSvg,type LaserProfile,type LaserEdge} from './profiles';

export function cuttingProfiles(kit:BearingKit='prom-smb'):LaserProfile[] {
  const f=forkContours(layout);
  const convert=(e:(typeof f.outer)[number]):LaserEdge=>e.kind==='line'?e:{...e,
    from:[e.center[0]+e.radius*Math.cos(e.start),e.center[1]+e.radius*Math.sin(e.start)],
    to:[e.center[0]+e.radius*Math.cos(e.end),e.center[1]+e.radius*Math.sin(e.end)]};
  return [...frameProfiles(true,kit),{id:'solid-crank',label:'One-piece closed-slot crank · 3 mm steel · quantity 4',
    thickness:3,quantity:4,shape:forkBlankShape(layout,true),circles:[f.bore],loops:[f.outer.map(convert),f.slot.map(convert)]}];
}
export function machiningSchedule(kit:BearingKit='prom-smb') {
  const source=cncMachiningSchedule(layout);
  return {units:'mm',partId:'tr8-quad-twin-pin-actuator',mainDiscs:3,discDiameter:64,sheetThickness:3,
    guidePlates:4,outerBearingCheeks:4,cranks:4,allSheetBlanks:15,
    bearingKit:kit,bearings:kit==='prom-smb'?promActuatorBearings.map(p=>({designation:p.name,dimensions:p.parameters,source:p.catalog!.sourceUrl,quantity:p.id==='smb-mf105-2z'?8:4})):undefined,
    screw:{...source.screw,...(kit==='prom-smb'?{bearingCentres:[-16.8,16.8],bearing:'SMB MF105 2Z',sleeves:screwSleeves,sleeveBore:5.02,sleeveOuter:5.9,
      grooves:[-19.8,19.8].map(center=>({center,width:.7,rootDiameter:4.8})),retainingRingsPerScrew:2,
      thrustShoulders:[-13,13],nominalThreadRootCoreDiameter:5.5,manufacturing:shoulderScrewPiece(0).component.manufacturing}:{}),fullNutEndMargin:13-nutTravel(layout,20)-twinPin.nutLength/2},
    nut:{quantity:4,onePiece:true,axialLength:8,roundEnvelopeDiameter:13,opposedFlatWidth:10,
      thread:{designation:'Tr8x8(P2) RH',starts:4,pitch:2,lead:8,includedAngle:30},
      trunnions:{diameter:4,axisZ:10,outwardEnd:9.7,inwardEnd:-8.2},manufacturing:nutPiece(0).component.manufacturing},
    shaft:{quantity:4,ends:[twinPin.shaftEnd,layout.outputTail],mainDiameter:6,journalDiameter:3,
      journalShoulder:twinPin.journalShoulder,innerRaceShoulderDiameter:3.6,mainShaftStart:twinPin.mainShaftStart,
      bearingCentres:[twinPin.innerBearingCentre,17],bearingSpan:22.7,manufacturing:shaftPiece(0).component.manufacturing},
    guide:{quantity:4,thickness:3,localY:[twinPin.guideLowY,twinPin.guideHighY],slotHeight:4.1,
      slotEndCentres:[-twinPin.guideSlotHalfTravel,twinPin.guideSlotHalfTravel],slotAxisZ:10,
      bearingPilot:5.8,bearingSeat:6.02,innerBearing:kit==='prom-smb'?'SMB MF63 2Z 3x6x2.5; flange7.2x0.6':'EZO SMF63ZZ 3x6x2.5; flange7.2x0.6',
      tabs:{depth:2.7,height:3,sockets:3.1}},
    crank:{quantity:4,piecesPerCrank:1,thickness:3,shaftPilot:5.8,shaftFinishedBore:6.05,matchedCrossPin:2},
    finishing:{screwBearingPilots:kit==='prom-smb'?'9.8 to assigned10.02 fit':'12.8 to assigned13.02 fit',outerBearingCheeks:'9.8 to assigned10.02 fit',guideBearingPilots:'5.8 to assigned6.02 fit'},
    requirements:['Laser cut all six sheet profiles and finish the bearing pilots, crank bores and matched transverse pin holes.',
      'The nut is custom machined brass, not the former purchased H nut plus a carrier. Its short thread engagement and trunnions require load qualification.',
      'Use a finished inner-bearing shoulder diameter of3.6 mm and radius no greater than the bearing manufacturer allowance.',
      'Frame clamping captures the laser tabs; inspect all bore alignment, slot edges, running fits, journal fatigue, wear and lubrication.']};
}
export function fabricationFiles(p:Parameters,pieces:ConfiguredPiece[]):FabricationFile[] {
  const kit=bearingKit(p),stem='TR8-twin-pin-64'+(kit==='prom-smb'?'-prom':''),out:FabricationFile[]=[];
  const add=(id:string,label:string,type:string,name:string,content:string)=>out.push({id,label,description:label,type,name,content});
  const profiles=cuttingProfiles(kit);
  for(const profile of profiles) {
    add(profile.id+'-dxf',profile.label+' · DXF 1:1','application/dxf',stem+'-'+profile.id+'.dxf',profileDxf(profile));
    add(profile.id+'-svg',profile.label+' · SVG 1:1','image/svg+xml',stem+'-'+profile.id+'.svg',profileSvg(profile));
  }
  let i=0;const blanks=profiles.flatMap(profile=>Array.from({length:profile.quantity},()=>{
    const component=detailComponent('blank-'+(++i),profile.label,{kind:'transform',translation:[i*80,0,0],rotation:[0,0,0],child:profile.shape});
    return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
  }));
  const macro=(name:string,items:ConfiguredPiece[])=>`import FreeCAD as App, Part, math\ndoc=App.newDocument(${JSON.stringify(name)})\n${componentPython(libraries,items)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Piece'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\n    if App.GuiUp: obj.ViewObject.ShapeColor=tuple(component_colors[i])\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`;
  add('laser-blanks','All15 laser blanks · 3 mm stock','text/x-python',stem+'-laser-blanks.FCMacro',macro('TwinPinBlanks',blanks));
  add('nut-native','One-piece twin-trunnion TR8 nut · native solid','text/x-python',stem+'-nut.FCMacro',macro('TwinPinNut',[nutPiece(0)]));
  add('shaft-native','Extended output shaft · native solid','text/x-python',stem+'-shaft.FCMacro',macro('TwinPinShaft',[shaftPiece(0)]));
  if(kit==='prom-smb')add('screw-native','TR8 screw · only two external retaining grooves','text/x-python',stem+'-screw.FCMacro',macro('TwinPinScrew',[shoulderScrewPiece(0)]));
  add('cut-manifest','Sheet quantities and finishing operations','application/json',stem+'-cut-manifest.json',JSON.stringify({units:'mm',scale:'1:1',thickness:3,
    bearingKit:kit,profiles:profiles.map(({shape:_shape,...profile})=>profile),physicalBlanks:15,onePieceNuts:4,onePieceCranks:4},null,2)+'\n');
  add('machining','Current shaft, nut and frame machining schedule','application/json',stem+'-machining.json',JSON.stringify(machiningSchedule(kit),null,2)+'\n');
  const csv=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"';
  add('bom','Bought and manufactured component list','text/csv;charset=utf-8',stem+'-components.csv',[
    ['ID','Component','Quantity','Supply','Designation','Material','Supplier URL'],
    ...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.supply,c.procurement?.designation,c.manufacturing?.material,c.procurement?.source]),
  ].map(row=>row.map(csv).join(',')).join('\n')+'\n');
  add('assembly','Slotted guide and twin-pin nut assembly instructions','text/plain;charset=utf-8',stem+'-assembly.txt',[
    'Machine each complete twin-pin nut from one brass blank. Thread it onto its TR8 screw; no H nut, nut carrier or flange fasteners are installed.',
    'Fit the four female/female30 mm columns to the motor disc, then the middle bearing disc and four male/female30 mm columns.',
    `Finish and install one ${kit==='prom-smb'?'SMB MF63 2Z':'EZO SMF63ZZ'} inner bearing in each laser guide. The flange faces toward the nut; assemble the guide, nut inward trunnion and extended shaft together.`,
    'The inward pin is captured in the closed straight guide slot. Seat both guide end tabs in their matching middle/end disc slots.',
    'Install one solid3 mm crank on the shaft and outward nut pin. Match-drill/ream the crank/shaft cross bore and press the2x10 dowel.',
    `Install the5.95 mm inner-race sleeve, outer ${kit==='prom-smb'?'SMB MF106 2Z':'EZO SMF106ZZ'} in its laser cheek, outer sleeve and original circlip. The shaft shoulder supports only the small bearing inner ring.`,
    'Capture every guide and cheek tab by fitting the end disc and tightening its column bolts. Inspect coaxiality, end float, pin/slot freedom and the whole±20 degree travel.',
  ].concat(kit==='prom-smb'?['Use the Prom SMB set: 8 MF105,4 MF106 and4 MF63 bearings. Screw bearing centres are -16.8/+16.8 mm. Finish screw pilots9.8 to10.02 mm. Use5.02x5.9 sleeves: outer0.7 mm, inner1.8 mm.',
    'Omit both inner screw rings and their grooves. The inner sleeves bear on the faced thread-root shoulders at X=±13. Keep only the two external DIN471 rings at X=±19.8 per screw; assign axial clearance with the assembled stack.']:[]).join('\n')+'\n');
  add('motion','Per-channel motion table','text/csv;charset=utf-8',stem+'-motion.csv','Angle_deg,NutTravel_mm,ScrewRotation_deg\n'+[-20,-10,0,10,20].map(angle=>[angle,nutTravel(layout,angle),-45*nutTravel(layout,angle)].join(',')).join('\n')+'\n');
  return out;
}
