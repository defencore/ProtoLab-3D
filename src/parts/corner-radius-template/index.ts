import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"corner-radius-template"};
export default {apiVersion:2,order:688,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
