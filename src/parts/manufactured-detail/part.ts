import { nativeThreadPython } from '../../core/thread-native';
import { threadMetadataPython } from '../../core/thread-callouts';
import { Group, Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import { defaults, parameters } from './configurator';
import { parseDetailRecipe } from '../../core/component-recipes';
import {
  component,
  pythonShape,
  boundaryThreadCallouts,
} from '../../core/assembly/boundary/shapes';
import { disposeModel } from '../../core/mechanical';
import { conformPrecisionMesh } from '../../core/assembly/precision-mesh';
function buildDetail(p: Parameters, nominal = false): Group {
  const model = new Group().add(
    component(parseDetailRecipe(String(p.recipe)), 'Configured detail', 0x87919c, [0, 0, 0], 0, {
      edgeTolerance: +p.meshEdgeTolerance,
      minimumTriangleArea: +p.meshMinimumTriangleArea,
      nominal,
    }),
  );
  return p.meshConform ? conformPrecisionMesh(model) : model;
}
const part: PartDefinition = {
  id: 'manufactured-detail',
  product: profile as ProductProfile,
  name: 'Configured manufactured detail',
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  description:
    'Reusable local feature definition for custom turned, milled, cut or printed details in project assemblies.',
  complexity: 'Configured detail',
  keywords: ['manufacture', 'detail', 'blank', 'CSG', 'drawing', 'material'],
  defaults,
  parameters,
  presets: [],
  validate(p) {
    try {
      parseDetailRecipe(String(p.recipe));
      if (typeof p.nativeRefine !== 'boolean')
        throw new Error('Choose a native CAD refinement policy.');
      if (typeof p.meshConform !== 'boolean')
        throw new Error('Choose a precision mesh conformity policy.');
      if (
        !Number.isFinite(+p.meshEdgeTolerance) ||
        +p.meshEdgeTolerance < 1e-8 ||
        +p.meshEdgeTolerance > 0.1 ||
        !Number.isFinite(+p.meshMinimumTriangleArea) ||
        +p.meshMinimumTriangleArea < 1e-12 ||
        +p.meshMinimumTriangleArea > 0.01
      )
        throw new Error('Component meshing policy is outside the supported finite range.');
      return [];
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  },
  buildGeometry: (p) => buildDetail(p),
  buildExportGeometry: (p) => buildDetail(p, true),
  python: (p) =>
    `${nativeThreadPython()}\ndef _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):\n        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape = (${pythonShape(parseDetailRecipe(String(p.recipe)))})${p.nativeRefine ? '.removeSplitter()' : ''}\n${threadMetadataPython(boundaryThreadCallouts(parseDetailRecipe(String(p.recipe))))}`,
  dimensions(p) {
    const root = part.buildGeometry(p, 'default');
    root.updateMatrixWorld(true);
    try {
      return new Box3().setFromObject(root, true).getSize(new Vector3()).toArray() as [
        number,
        number,
        number,
      ];
    } finally {
      disposeModel(root);
    }
  },
  notes:
    'Prototype local feature geometry. A project must assign the material, blank, manufacturing operations, tolerances and drawing; the geometry alone does not qualify a production part.',
};
export default part;
