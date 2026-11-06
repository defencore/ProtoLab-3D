import type {ParameterDefinition} from '../../core/types';
export const defaults={screwModel:'tr8x8-p2',discPattern:'lightened',angleA:0,angleB:0,angleC:0,angleD:0};
export const parameters:ParameterDefinition[]=[
  {key:'screwModel',label:'Trapezoidal screw and matching nut',type:'select',group:'Drive',description:'Same 2 mm pitch and mechanism travel. Lead and number of starts change together in the screw, nut and FreeCAD export.',options:[
    {value:'tr8x8-p2',label:'TR8×8(P2) · 4 starts · 8 mm/rev'},
    {value:'tr8x2-p2',label:'TR8×2(P2) · 1 start · 2 mm/rev'},
  ]},
  {key:'discPattern',label:'Disc construction',type:'select',group:'Discs',options:[
    {value:'lightened',label:'Lightened · central Ø5 bore'},
    {value:'solid',label:'Solid web · central Ø5 bore'},
  ]},
  ...['A','B','C','D'].map(id=>({key:'angle'+id,label:'Output '+id,type:'number' as const,group:'Output angles',min:-20,max:20,step:1,unit:'°'})),
];
