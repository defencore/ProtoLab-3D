import { nativeThreadPython } from '../../core/thread-native';
import { threadMetadataPython } from '../../core/thread-callouts';
import { Group, Box3, Vector3 } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import profile from './product.json';
import { defaults, parameters } from './configurator';
import {
  detailRecipe,
  detailIdentityParameters,
  hasManufacturingRecipe,
} from './lib/configuration';
import presetData from './presets.json';
import {
  component,
  pythonShape,
  boundaryThreadCallouts,
} from '../../core/assembly/boundary/shapes';
import { disposeModel } from '../../core/mechanical';
import { conformPrecisionMesh } from '../../core/assembly/precision-mesh';
import {
  initializeManifoldGeometry,
  manifoldBoundaryComponent,
} from '../../core/assembly/manifold-boundary';
function buildDetail(p: Parameters, state: string, nominal = false): Group {
  if (p.meshBackend === 'manifold')
    return new Group().add(
      manifoldBoundaryComponent(detailRecipe(p, state), 'Configured detail', 0x87919c),
    );
  const model = new Group().add(
    component(detailRecipe(p, state), 'Configured detail', 0x87919c, [0, 0, 0], 0, {
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
  identityParameters: detailIdentityParameters,
  presets: presetData as Preset[],
  states: [
    {
      id: 'default',
      label: 'Detail',
      description: 'The authored detail in its default or installed form.',
    },
    {
      id: 'manufacturing',
      label: 'Manufacturing form',
      description: 'The explicitly authored free form of the same physical detail.',
      availableWhen: hasManufacturingRecipe,
    },
  ],
  updateParameters(p, changedKey) {
    if (changedKey === 'mode' && ['plate', 'sleeve', 'shaft', 'bracket'].includes(String(p.mode))) {
      const { manufacturingRecipe: _freeForm, ...parameters } = p;
      return parameters;
    }
    return p;
  },
  async initializeGeometry(p) {
    if (p.meshBackend === 'manifold') await initializeManifoldGeometry();
  },
  validate(p, state) {
    try {
      detailRecipe(p, state);
      if (!['jscad', 'manifold'].includes(String(p.meshBackend)))
        throw new Error('Choose a supported surface construction policy.');
      if (p.meshBackend === 'manifold' && p.meshConform)
        throw new Error('Manifold surfaces already share their exact indexed boundary.');
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
  buildGeometry: (p, state) => buildDetail(p, state),
  buildExportGeometry: (p, state) => buildDetail(p, state, true),
  python: (p, state) =>
    `${nativeThreadPython()}\ndef _pl_transform(shape, translation, rotation):\n    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)], rotation):\n        if angle: shape.rotate(App.Vector(0,0,0),axis,angle)\n    shape.translate(App.Vector(*translation))\n    return shape\nshape = (${pythonShape(detailRecipe(p, state))})${p.nativeRefine ? '.removeSplitter()' : ''}\n${threadMetadataPython(boundaryThreadCallouts(detailRecipe(p, state)))}`,
  dimensions(p, state) {
    const root = part.buildGeometry(p, state);
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
