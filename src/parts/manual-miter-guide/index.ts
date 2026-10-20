import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"manual-miter-guide"};
export default {apiVersion:2,order:692,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
