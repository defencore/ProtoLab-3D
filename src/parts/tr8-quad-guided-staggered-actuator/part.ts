import type { Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import {createGuidedCncQuadDefinition} from '../tr8-quad-guided-actuator/part';
import presets from './presets.json';
import product from './product.json';
export default createGuidedCncQuadDefinition('staggered-56',presets as Preset[],product as ProductProfile);
