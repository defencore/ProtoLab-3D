import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"angle-drill-jig"};
export default {apiVersion:2,order:685,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
