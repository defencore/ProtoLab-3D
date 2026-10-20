import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"wire-bending-jig"};
export default {apiVersion:2,order:689,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
