import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"indexing-disc-jig"};
export default {apiVersion:2,order:690,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
