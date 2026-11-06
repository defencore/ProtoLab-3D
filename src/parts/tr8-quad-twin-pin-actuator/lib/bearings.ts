import type {Parameters} from '../../../core/types';
import type {ConfiguredPiece} from '../../../core/assembly/detail-instances';
import {detailComponent} from '../../../core/component-recipes';
import {cylinder,subtract} from '../../../core/assembly/boundary/shapes';
import {promBearing} from '../../flanged-ball-bearing/part';
import {tr8ScrewShape,type Tr8Lead} from '../../tr8-compact-actuator/part';
import {layout} from './layout';

export type BearingKit='prom-smb'|'reference';
export const bearingKit=(p:Parameters):BearingKit=>p.bearingKit==='reference'?'reference':'prom-smb';
export const screwSleeves=[
  {id:'fixed-outer-spacer',from:-19.5,to:-18.8},
  {id:'fixed-inner-spacer',from:-14.8,to:-13},
  {id:'floating-inner-spacer',from:13,to:14.8},
  {id:'floating-outer-spacer',from:18.8,to:19.5},
] as const;

/** Keep the two end grooves; the thread-root shoulders carry the inner sleeves. */
export function shoulderScrewPiece(angle:number,threadLead:Tr8Lead=8):ConfiguredPiece {
  const travel=layout.lever*Math.tan(angle*Math.PI/180);
  const label=threadLead===8?'TR8 screw · 50 mm · two external retaining grooves':'TR8×2(P2) single-start screw · 50 mm · two external retaining grooves';
  const component=detailComponent('lead-screw',label,tr8ScrewShape({
    threadStartX:-13,threadEndX:13,screwAxisZ:layout.lever,angleDeg:-360*travel/threadLead,threadLead,
    journals:[{from:-29,to:-21,diameter:4},{from:-21,to:-13,diameter:5},{from:13,to:21,diameter:5}],
    grooves:[-19.8,19.8].map(center=>({from:center-.35,to:center+.35,rootDiameter:4.8})),
  }));
  component.manufacturing={material:`Steel TR8×${threadLead}(P2) stock; grade and fits per drawing`,blank:`250 mm purchased TR8×${threadLead}(P2) threaded stock, cut and turned to 50 mm`,
    processes:['cutting','turning'],requirements:[
      'Keep the 26 mm working thread from X=-13 to +13. Turn Ø5 journals and the Ø4 coupling stub, with only two DIN471 grooves at X=-19.8 and +19.8 mm.',
      'Face both thread-root shoulders square at X=±13. The 1.8 mm inner sleeves bear on the continuous thread-root core annulus; do not undercut or round away that thrust land.',
      'Confirm the actual stock root diameter, annular contact area, thrust load and shoulder finish. Set axial end float with the complete bearing, sleeve and ring stack; do not impose unintended preload.',
    ]};
  return {component,label,color:0x92a7b6,requireSingleSolid:true};
}

/** MF105 flange thickness moves its centre 0.2 mm inward; retain the existing journals/rings. */
export function stockBearingPieces(p:Parameters,pieces:ConfiguredPiece[],angle:number):ConfiguredPiece[] {
  if(bearingKit(p)==='reference')return pieces.map(piece=>{
    if(piece.component.libraryId!=='flanged-ball-bearing')return piece;
    const c=piece.component,dimensions=`${c.parameters.bore}×${c.parameters.outer}×${c.parameters.width} mm`;
    const designation=`${c.procurement!.designation.split(' · ')[0]} · ${dimensions}`;
    const role=c.id.startsWith('screw-bearing-')?(c.id.endsWith('0')?'Fixed screw bearing':'Floating screw bearing'):
      c.id==='output-inner-guide-bearing'?'Inner guide bearing':'Outer output bearing';
    const label=`${role} · ${designation}`;
    return {...piece,label,component:{...c,name:label,procurement:{...c.procurement!,designation}}};
  });
  return pieces.filter(piece=>!['screw-circlip-1','screw-circlip-2'].includes(piece.component.id)).map(piece=>{
    const id=piece.component.id,screw=id.startsWith('screw-bearing-');
    if(id==='lead-screw')return shoulderScrewPiece(angle);
    if(piece.component.libraryId==='flanged-ball-bearing') {
      const preset=promBearing(screw?'smb-mf105-2z':id==='output-inner-guide-bearing'?'smb-mf63-2z':'smb-mf106-2z');
      const translation=[...piece.component.placement.translation] as [number,number,number];
      if(screw)translation[0]=id.endsWith('0')?-16.8:16.8;
      const dimensions=`${preset.parameters.bore}×${preset.parameters.outer}×${preset.parameters.width} mm`;
      const designation=`${preset.name} · ${dimensions}`;
      const role=screw?(id.endsWith('0')?'Fixed screw bearing':'Floating screw bearing'):
        id==='output-inner-guide-bearing'?'Inner guide bearing':'Outer output bearing';
      const label=`${role} · ${designation}`;
      return {...piece,label,component:{...piece.component,name:label,presetId:preset.id,parameters:{...preset.parameters},
        placement:{...piece.component.placement,translation},procurement:{designation,
          manufacturer:'SMB Bearings',source:preset.catalog!.sourceUrl}}};
    }
    const sleeve=screwSleeves.find(s=>s.id===id);
    if(!sleeve)return piece;
    const length=sleeve.to-sleeve.from,label=`MF105 inner-race sleeve · 5.02×5.9×${length.toFixed(1)} mm`;
    const component=detailComponent(id,label,subtract(cylinder(2.95,length,[sleeve.from,0,layout.lever],'x'),
      cylinder(2.51,length+.2,[sleeve.from-.1,0,layout.lever],'x')));
    component.manufacturing={material:'Bearing steel; fits and end float per drawing',blank:'Turned precision tube',processes:['turning'],
      requirements:['Finish the Ø5.9 abutment to contact only the MF105 inner ring. Confirm actual SMB ring-face geometry before production.',
        'Outer sleeves are 0.7 mm. Inner sleeves are 1.8 mm and bear on the square thread-root shoulders at X=±13; omit both inner retaining rings and their grooves. No bore adapters are used.',
        'Assign sleeve length tolerance and end float with the actual bearing stack; do not preload bearings through an overlong sleeve.']};
    return {...piece,label,component};
  });
}
