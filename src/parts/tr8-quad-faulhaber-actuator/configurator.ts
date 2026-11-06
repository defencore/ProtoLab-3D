import type {ParameterDefinition} from '../../core/types';
export const defaults={discPattern:'lightened',angleA:0,angleB:0,angleC:0,angleD:0};
export const parameters:ParameterDefinition[]=[
  {key:'discPattern',label:'Disc construction',type:'select',group:'Discs',options:[
    {value:'lightened',label:'Lightened · central Ø5 bore'},
    {value:'solid',label:'Solid web · central Ø5 bore'},
  ]},
  ...['A','B','C','D'].map(id=>({key:'angle'+id,label:'Output '+id,type:'number' as const,group:'Output angles',min:-20,max:20,step:1,unit:'°'})),
];
