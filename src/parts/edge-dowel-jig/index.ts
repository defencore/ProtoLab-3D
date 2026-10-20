import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"edge-dowel-jig"};
export default {apiVersion:2,order:684,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
