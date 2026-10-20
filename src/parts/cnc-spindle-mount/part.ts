import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { nativeThreadPython } from '../../core/thread-native';
import { threadMetadataPython } from '../../core/thread-callouts';
import {
  component,
  pythonShape,
  boundaryThreadCallouts,
} from '../../core/assembly/boundary/shapes';
import { Group } from 'three';
import profile from './product.json';
import presets from './presets.json';
import { defaults, parameters } from './configurator';
import { spindleMountLayout, mountShape, validateMount } from './lib/model';
export { spindleMountLayout } from './lib/model';
export { defaults as spindleMountDefaults } from './configurator';
const part: PartDefinition = {
  id: 'cnc-spindle-mount',
  product: profile as ProductProfile,
  name: 'Two-piece spindle clamp detail',
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  description:
    'Separate machined rear block and front cap with a common spindle bore and explicit fastening layout.',
  complexity: 'Manufactured detail',
  keywords: ['CNC', 'spindle', 'clamp', 'split', 'mount', '65', '80', '100'],
  defaults,
  parameters,
  presets: presets as Preset[],
  validate: (p) => validateMount(p),
  buildGeometry: (p) =>
    new Group().add(component(mountShape(p), String(p.component) + ' spindle clamp', 0x59616b)),
  python(p) {
    const shape = mountShape(p);
    return (
      nativeThreadPython() +
      '\ndef _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):\n        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape = (' +
      pythonShape(shape) +
      ').removeSplitter()\n' +
      'if shape.isNull() or not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1 or shape.Volume<=0:\n    raise ValueError("A clamp detail must be one valid closed positive solid.")\n' +
      threadMetadataPython(boundaryThreadCallouts(shape)) +
      (p.component === 'back' && Number(p.threadFitAllowance) > 0
        ? `\ncomponent_metadata[0]["ThreadFitAllowance"] = ${JSON.stringify(`Authored radial inspection allowance ${p.threadFitAllowance} mm; nominal metric designation unchanged. This is not a released fit or tolerance class; verify the tap, bolt and drawing.`)}`
        : '')
    );
  },
  dimensions(p) {
    const s = spindleMountLayout(p);
    return [
      s.outerWidth,
      p.component === 'back' ? s.backSplitY - s.rearFaceY : s.capFrontY - s.capSplitY,
      s.clampHeight,
    ];
  },
  notes:
    'Own machined aluminium design, not a supplier mounting drawing. Manufacture rear block and cap separately, assemble with the designed split gap, then finish the bore to the required fit. Bore allowance, bolt engagement, material grade, torque and structural acceptance require a drawing. Simple retains thread callouts; Full creates authored metric flanks. An explicitly configured threadFitAllowance is radial inspection clearance, not a released thread fit or tolerance class. Bolts are separate library occurrences.',
};
export default part;
