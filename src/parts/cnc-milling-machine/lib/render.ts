import { Box3, Group, Mesh, Vector3 } from 'three';
import type { Parameters, PartDefinition } from '../../../core/types';
import { componentGeometry } from '../../../core/assembly/detail-instances';
import { disposeModel } from '../../../core/mechanical';
import { millingLibraries, millingPieces } from './composition';
/** Cache repeated configured geometry within this render; each occurrence retains independent placement/material. */
export function millingGeometry(p: Parameters, state: string, nominal = false): Group {
  const templates = new Map<string, Group>();
  const libraries = millingLibraries.map((part) => {
    const builder = (values: Parameters, s: string) => {
      const key = JSON.stringify([part.id, values, s, nominal]);
      let template = templates.get(key);
      if (!template) {
        template = (
          nominal && part.buildExportGeometry ? part.buildExportGeometry : part.buildGeometry
        )(values, s);
        templates.set(key, template);
      }
      const instance = template.clone(true);
      instance.traverse((o) => {
        if (o instanceof Mesh)
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => m.clone())
            : o.material.clone();
      });
      return instance;
    };
    return {
      ...part,
      buildGeometry: builder,
      buildExportGeometry: builder,
    } satisfies PartDefinition;
  });
  try {
    return componentGeometry(libraries, millingPieces(p, state), nominal);
  } finally {
    for (const template of templates.values()) disposeModel(template);
  }
}
export function millingDimensions(p: Parameters, state: string): [number, number, number] {
  const model = millingGeometry(p, state);
  try {
    model.updateMatrixWorld(true);
    return new Box3().setFromObject(model, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(model);
  }
}
