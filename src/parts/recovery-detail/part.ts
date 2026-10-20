import { Box3, Vector3 } from 'three';
import type { PartDefinition } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { component } from '../../core/assembly/recovery/shapes';
import { recoveryDetailPython } from '../../core/assembly/recovery/python';
import { parseRecoveryRecipe } from '../../core/recovery-component-recipes';
import { disposeModel } from '../../core/mechanical';
import profile from './product.json';
import { defaults, parameters } from './configurator';
const part: PartDefinition = {
  id: 'recovery-detail',
  product: profile as ProductProfile,
  name: 'Configured threaded recovery detail',
  category: 'STRUCTURAL PARTS',
  subgroup: 'BRACKETS & MOUNTS',
  icon: 'bracket',
  description:
    'Reusable authored detail with exact planar features, spring barrels and qualified printed-thread geometry.',
  complexity: 'Configured detail',
  keywords: ['detail', 'thread', 'print', 'machine', 'recovery'],
  defaults,
  parameters,
  presets: [],
  validate(p, state) {
    try {
      if (state !== 'default') return ['Select the physical detail.'];
      parseRecoveryRecipe(String(p.recipe));
      return [];
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
  },
  buildGeometry: (p) =>
    component(parseRecoveryRecipe(String(p.recipe)), 'Configured recovery detail', 0xc6cdd5),
  python: (p) => recoveryDetailPython(parseRecoveryRecipe(String(p.recipe))),
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
    'Prototype authored geometry; assign material, blank, operations and drawing in the project. Simple uses nominal thread envelopes with callouts. Full exports actual helical flanks; printed features retain the specified fit allowance.',
};
export default part;
