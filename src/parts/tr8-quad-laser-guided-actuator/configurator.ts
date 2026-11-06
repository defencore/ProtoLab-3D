import type { Parameters, ParameterDefinition } from '../../core/types';
import { defaults as baseDefaults, parameters as baseParameters } from '../tr8-quad-cnc-actuator/part';
export const defaults:Parameters={...baseDefaults,crankConstruction:'laminated'};
export const parameters:ParameterDefinition[]=[
  {key:'crankConstruction',label:'Output crank construction',type:'select',group:'Fabrication',options:[
    {value:'laminated',label:'Four laser laminations · welded · no crank cross-drilling'},
    {value:'solid',label:'One 3 mm laser plate · matched cross-drilling'},
  ]},
  ...baseParameters,
];
