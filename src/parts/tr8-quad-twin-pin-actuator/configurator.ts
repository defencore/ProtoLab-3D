import {parameters as original,defaults as base} from '../tr8-quad-cnc-actuator/part';
export const defaults={...base,bearingKit:'prom-smb'};
import type {ParameterDefinition} from '../../core/types';
export const parameters:ParameterDefinition[]=[{key:'bearingKit',label:'Bearing set',type:'select',group:'Bearings',options:[
  {value:'prom-smb',label:'Prom.ua · SMB MF105 / MF106 / MF63'},
  {value:'reference',label:'Original F695 / EZO reference bearings'},
]},...original.map(field=>({ ...field, ...(field.options ? { options: field.options.map(option=>({ ...option })) } : {}), ...(field.key.startsWith('angle') ? { description:'Independent output angle; the laser frame and slotted guides stay fixed.' } : {}) }))];
