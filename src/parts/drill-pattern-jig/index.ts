import type { PartModule } from '../../core/part-modules';
import definition from './part';
const part={...definition,id:"drill-pattern-jig"};
export default {apiVersion:2,order:681,dependencies:['manufactured-detail','purchased-component'],part} satisfies PartModule;
