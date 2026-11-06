import {defaults as originalDefaults,parameters as originalParameters} from '../tr8-quad-twin-pin-actuator/part';
import type {ParameterDefinition} from '../../core/types';
export const defaults={...originalDefaults,discPattern:'lightened'};
export const parameters:ParameterDefinition[]=[{key:'discPattern',label:'Disc construction',type:'select',group:'Discs',options:[
  {value:'lightened',label:'Lightened · central Ø5 bore'},
  {value:'solid',label:'Solid web · central Ø5 bore'},
]},...originalParameters.map((field) => ({ ...field, ...(field.options ? { options: field.options.map((option) => ({ ...option })) } : {}) }))];
