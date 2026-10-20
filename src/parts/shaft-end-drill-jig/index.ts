import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"shaft-end-drill-jig"};
export default {apiVersion:2,order:683,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
