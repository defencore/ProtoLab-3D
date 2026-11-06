import {bearingKit,type BearingKit} from '../../tr8-quad-twin-pin-actuator/part';
import type {Parameters,FabricationFile} from '../../../core/types';
import {componentPython,type ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import original,{cuttingProfiles as originalProfiles,nutPiece,shoulderScrewPiece} from '../../tr8-quad-twin-pin-actuator/part';
import {libraries,nutTravel} from '../../tr8-quad-cnc-actuator/part';
import {profileDxf,profileSvg} from '../../tr8-quad-laser-guided-actuator/part';
import {frameProfiles,lighteningCircles,type LaserProfile,type DiscPattern} from './frame';
import {layout,compact,diameterLimit} from './layout';
import {shaftPiece} from './channel';

export function cuttingProfiles(pattern:DiscPattern='lightened',kit:BearingKit='prom-smb'):LaserProfile[] {
  return [...frameProfiles(true,pattern,kit),originalProfiles().find(p=>p.id==='solid-crank')!];
}
export function machiningSchedule(pattern:DiscPattern='lightened',kit:BearingKit='prom-smb') {
  const inherited=JSON.parse(original.fabricationFiles!({...original.defaults,bearingKit:kit}).find(file=>file.id==='machining')!.content);
  return {...inherited,partId:'tr8-quad-twin-pin-mini-actuator',discDiameter:54,centralBoreDiameter:5,guideTabCentreZ:-2.75,discPattern:pattern,
    lightening:pattern==='lightened'?{holesPerDisc:4,motorHoleDiameter:7.4,fixedEndHoleDiameter:5.4,
      holes:Object.fromEntries((['motor','fixed','end'] as const).map(role=>[role,lighteningCircles(role)])),
      minimumNewHoleLigament:3,steelDensityGPerCm3:7.85,centralBoreSavingG:3*3*3.141592653589793*2.5**2*.00785,nominalSteelMassSavingG:3*7.85e-3*4*Math.PI*(3.7**2+2*2.7**2)}:undefined,
    shaft:{...inherited.shaft,ends:[compact.shaftEnd,layout.outputTail],finishedLength:layout.outputTail-compact.shaftEnd,
      bearingCentres:layout.outputBearingCentres,bearingSpan:layout.outputBearingCentres[1]-layout.outputBearingCentres[0],
      grooveCentre:layout.outputClip,flatStart:layout.outputTail-6.2,manufacturing:shaftPiece(0).component.manufacturing},
    shortSleeve:{bore:6.05,outerDiameter:6.85,length:compact.sleeveTo-compact.sleeveFrom},
    columns:{pitchRadius:layout.postRadius,firstClockDegrees:layout.postClock,quantity:8,bodyLength:30},
    outerCheek:{localY:[compact.outerCheekLow,compact.outerCheekHigh]},diameterLimit:diameterLimit(),
    guide:{...inherited.guide,thickness:2,localY:[-7.05,-5.05],bodyZ:[-5.25,16.2],
      tabs:{depth:2.7,height:3,centreZ:-2.75,socketWidth:2.1,socketHeight:3.1},
      grossInPlaneSectionInertiaRatio:2*21.45**3/(3*18.7**3),
      qualification:'Gross-section comparison only; actual slotted plate stiffness, bearing loads and key reactions need application review.'},
    requirements:[...inherited.requirements,
      'Every disc has a coaxial diameter5 mm centre bore. Use the 2 mm guide walls with end keys at Z=-2.75 mm and matching2.1x3.1 mm sockets.',
      'Use the Ø54 cutting files and shifted outer-cheek sockets; column centres are at radius23.5 mm, clock18+90n degrees.',
      'External shaft tails and flat lengths are shortened together; inspect output attachment access, groove end land and frame edge ligaments.',
      'Motor/screw axes stay at radius16 mm; shrinking only the outward bearing stack does not move the approved central guide/nut mechanism.']};
}
export function fabricationFiles(p:Parameters,pieces:ConfiguredPiece[]):FabricationFile[] {
  const pattern=p.discPattern as DiscPattern,kit=bearingKit(p),stem='TR8-twin-pin-54-'+pattern+(kit==='prom-smb'?'-prom':''),out:FabricationFile[]=[];
  const add=(id:string,label:string,type:string,name:string,content:string)=>out.push({id,label,description:label,type,name,content});
  const profiles=cuttingProfiles(pattern,kit);
  for(const profile of profiles) {
    add(profile.id+'-dxf',profile.label+' · DXF 1:1','application/dxf',stem+'-'+profile.id+'.dxf',profileDxf(profile));
    add(profile.id+'-svg',profile.label+' · SVG 1:1','image/svg+xml',stem+'-'+profile.id+'.svg',profileSvg(profile));
  }
  let index=0;const blanks=profiles.flatMap(profile=>Array.from({length:profile.quantity},()=>{
    const component=detailComponent('blank-'+(++index),profile.label,{kind:'transform',translation:[index*70,0,0],rotation:[0,0,0],child:profile.shape});
    return {component,label:profile.label,color:0x79909f,requireSingleSolid:true};
  }));
  const macro=(name:string,items:ConfiguredPiece[])=>`import FreeCAD as App, Part, math\ndoc=App.newDocument(${JSON.stringify(name)})\n${componentPython(libraries,items)}\nfor i,s in enumerate(components):\n    obj=doc.addObject('Part::Feature','Piece'+str(i))\n    obj.Label=component_labels[i]\n    obj.Shape=s\n    if App.GuiUp: obj.ViewObject.ShapeColor=tuple(component_colors[i])\ndoc.recompute()\nif App.GuiUp:\n    import FreeCADGui as Gui\n    Gui.activeDocument().activeView().viewAxonometric()\n    Gui.activeDocument().activeView().fitAll()\n`;
  add('laser-blanks','All 15 laser blanks · 2 and 3 mm stock','text/x-python',stem+'-laser-blanks.FCMacro',macro('TwinPin54Blanks',blanks));
  add('nut-native','Unchanged one-piece twin-trunnion nut','text/x-python',stem+'-nut.FCMacro',macro('TwinPin54Nut',[nutPiece(0)]));
  add('shaft-native','Short 29.95 mm output shaft','text/x-python',stem+'-shaft.FCMacro',macro('TwinPin54Shaft',[shaftPiece(0)]));
  if(kit==='prom-smb')add('screw-native','TR8 screw · only two external retaining grooves','text/x-python',stem+'-screw.FCMacro',macro('TwinPin54Screw',[shoulderScrewPiece(0)]));
  add('cut-manifest','Ø54 sheet quantities and finishing operations','application/json',stem+'-cut-manifest.json',JSON.stringify({units:'mm',scale:'1:1',discDiameter:54,centralBoreDiameter:5,guideTabCentreZ:-2.75,discPattern:pattern,bearingKit:kit,stockThicknesses:[2,3],
    profiles:profiles.map(({shape:_shape,...p})=>p),physicalBlanks:15,onePieceNuts:4,onePieceCranks:4},null,2)+'\n');
  add('machining','Ø54 shaft, sleeve and frame schedule','application/json',stem+'-machining.json',JSON.stringify(machiningSchedule(pattern,kit),null,2)+'\n');
  const csv=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
  add('bom','Ø54 bought and manufactured component list','text/csv;charset=utf-8',stem+'-components.csv',[
    ['ID','Component','Quantity','Supply','Designation','Material','Supplier URL'],...pieces.map(({component:c})=>[c.id,c.name,c.quantity,c.supply,c.procurement?.designation,c.manufacturing?.material,c.procurement?.source]),
  ].map(row=>row.map(csv).join(',')).join('\n')+'\n');
  add('assembly','Ø54 guide and short-shaft assembly instructions','text/plain;charset=utf-8',stem+'-assembly.txt',[
    'Use three Ø54x3 discs and the supplied compact socket pattern. Fit the purchased30 mm columns at radius23.5 mm and clock18+90n degrees.',
    `Assemble the unchanged twin-trunnion nuts, solid cranks and ${kit==='prom-smb'?'SMB MF63 2Z':'EZO SMF63ZZ'} inner bearings. Use the revised2 mm laser guide walls, body Z=-5.25..16.2, with end keys at Z=-2.75 mm in2.1x3.1 mm disc slots.`,
    'Use the29.95 mm shafts, with outward ends at Y=22.5 and retaining grooves at Y=14.4 mm. Keep the inward journal, crank cross-hole and guide positions unchanged.',
    `Install the0.95 mm inner-race sleeves. Outer ${kit==='prom-smb'?'SMB MF106 2Z':'EZO SMF106ZZ'} centres are now at local Y=12 mm; their four tabbed cheeks sit at Y=9.9..12.9 mm.`,
    'Fit the translated outer sleeves/circlips, capture all tabs with the end disc and inspect alignment, axial float, output access and the complete±20 degree travel.',
  ].concat(kit==='prom-smb'?['Use8 SMB MF105 2Z,4 MF106 2Z and4 MF63 2Z bearings from Prom.ua. Screw centres are -16.8/+16.8 mm; finish screw pilots9.8 to10.02 mm. Use5.02x5.9 sleeves with0.7 mm outer and1.8 mm inner lengths.',
    'Omit the two inner screw rings and their grooves. Seat the1.8 mm sleeves against the thread-root shoulders at X=±13. Keep only the two outer DIN471 rings at X=±19.8 per screw and assign end float with the actual stack.']:[]).join('\n')+'\n');
  add('motion','Unchanged ±20° motion table','text/csv;charset=utf-8',stem+'-motion.csv','Angle_deg,NutTravel_mm,ScrewRotation_deg\n'+[-20,-10,0,10,20].map(a=>[a,nutTravel(layout,a),-45*nutTravel(layout,a)].join(',')).join('\n')+'\n');
  return out;
}
