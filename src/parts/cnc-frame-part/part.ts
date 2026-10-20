import type { PartDefinition, Parameters } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import presets from './presets.json';
import detail from '../manufactured-detail/part';
import { defaults, parameters } from './configurator';
import { frameShape, validateFrame, frameManufacturing, frameDimensions } from './lib/model';
import { movingSaddlePreviewShape } from './lib/preview';
const definition = (p: Parameters, preview = false) => ({
  ...detail.defaults,
  recipe: JSON.stringify(
    preview && p.role === 'z-moving-box' ? movingSaddlePreviewShape(frameShape(p)) : frameShape(p),
  ),
  meshEdgeTolerance: 1e-6,
  meshMinimumTriangleArea: 1e-10,
  meshConform: true,
  nativeRefine: false,
});
const part: PartDefinition = {
  id: 'cnc-frame-part',
  name: 'Fabricated frame and mounting details',
  product: profile as ProductProfile,
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  complexity: 'Machined / drilled stock detail',
  description:
    'Independent hollow frame members, datum pads, gantry and axis plates, brackets and compression sleeves for a bolted CNC mill.',
  keywords: ['CNC', 'frame', 'gantry', 'rail pad', 'machining', 'plate', 'compression sleeve'],
  defaults,
  parameters,
  presets,
  validate: (p) => validateFrame(p),
  buildGeometry: (p, s) => detail.buildGeometry(definition(p, true), s),
  buildExportGeometry: (p, s) => detail.buildExportGeometry!(definition(p, true), s),
  dimensions: (p, s) => frameDimensions(p) ?? detail.dimensions(definition(p, true), s),
  python: (p, s) =>
    detail.python(definition(p), s) +
    `\ncomponent_metadata[0].update(${JSON.stringify({ FabricatedRole: String(p.role), DesignMaterial: String(p.material), ThreadInspectionAllowance: String(p.threadFitAllowance), ManufacturingRequirements: JSON.stringify(frameManufacturing(p)) })})`,
  notes:
    'A separate manufacturable blank and local machining pattern, not a welded collection presented as one fabricated part. Material grades, rail datums, functional tolerances, cutting loads and actual mounting details require design release. Structural printed parts are not included.',
  assessment: (p) => frameManufacturing(p).requirements,
  sources: [],
};
export {
  frameShape,
  frameHoles,
  frameManufacturing,
  frameReadheadEar,
  frameBounds,
  frameDimensions,
} from './lib/model';
export type { FrameHole, FrameBounds, FrameReadheadEar } from './lib/model';
export default part;
