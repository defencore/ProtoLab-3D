import componentPart, {
  models,
  sourceFrame,
  assemblyPlacement,
  sheetFabrication,
} from '../../multicopter-frame-component/part';
import type { SourceComponent } from '../../multicopter-frame-component/lib/model';
import {
  componentGeometry,
  componentPython,
  type ConfiguredPiece,
} from '../../../core/assembly/detail-instances';
import { Box3, Vector3 } from 'three';
import { disposeModel } from '../../../core/mechanical';
import type { Parameters } from '../../../core/types';
import type { AssemblyComponent, AssemblyDefinition } from '../../../core/product-types';
export { models };
export function occurrence(m: SourceComponent): AssemblyComponent {
  const material =
    m.route === 'sheet'
      ? 'Carbon/epoxy laminate per upstream drawing'
      : m.route === 'print'
        ? m.frameId === 'comet-y6'
          ? 'PC/CF per COMET print profile'
          : 'Source camera mount; verify polymer specification'
        : m.route === 'soft'
          ? 'Source soft pad; verify compound'
          : 'Source hardware; verify grade and procurement specification';
  return {
    id: m.id,
    name: m.label,
    libraryId: 'multicopter-frame-component',
    parameters: { component: m.id },
    state: 'default',
    presetId: m.id,
    quantity: 1,
    placement: { translation: assemblyPlacement(m), rotation: [0, 0, 0] },
    supply: m.route === 'purchase' ? 'purchased' : 'manufactured',
    ...(m.route === 'purchase'
      ? {
          procurement: {
            designation: m.label,
            manufacturer: sourceFrame(m.frameId).name + ' source hardware',
            source: sourceFrame(m.frameId).source.repository,
          },
        }
      : {
          manufacturing: {
            material,
            blank: m.dimensions.map((v) => v.toFixed(3)).join(' x ') + ' mm',
            processes:
              m.route === 'sheet'
                ? ['cutting', 'drilling']
                : m.route === 'print'
                  ? ['printing']
                  : ['cutting'],
            requirements: [
              'Preserve the pinned upstream contour and CAD-matched stock thickness. Finish countersinks separately and verify actual material before fabrication.',
            ],
          },
        }),
  };
}
export function composition(p: Parameters): AssemblyDefinition {
  const f = sourceFrame(p.model);
  return {
    components: f.parts.map(occurrence),
    issues: [
      'Flight release is unresolved: actual laminate, fastener grade, insert pull-through, joint slip, whole-frame bending/torsion and vibration need verification.',
      ...f.hardware,
      ...f.changes,
    ],
  };
}
export function pieces(p: Parameters, state: string): ConfiguredPiece[] {
  const f = sourceFrame(p.model),
    models = f.parts;
  const selected =
    state === 'body'
      ? models.filter((m) => m.sourceIndex === f.body)
      : state === 'arm'
        ? models.filter((m) => m.sourceIndex === f.arms[0])
        : state === 'root'
          ? models.filter((m) => f.root.includes(m.sourceIndex))
          : state === 'cut'
            ? models.filter((m) => m.route === 'sheet')
            : state === 'print'
              ? models.filter((m) => m.route === 'print')
              : models;
  let x = 0,
    z = -10;
  return selected.map((m) => {
    const component = occurrence(m);
    let position: [number, number, number] = [0, 0, 0];
    if (state === 'cut' || state === 'print') {
      const flat = state === 'print' ? m.printPose : sheetFabrication[m.id];
      component.placement = flat
        ? { translation: [0, 0, 0], rotation: flat.rotation as [number, number, number] }
        : { translation: [0, 0, 0], rotation: [0, 0, 0] };
      const low = flat ? flat.min : m.meshMin;
      position = [x - low[0], -low[1], -low[2]];
      x += (flat ? flat.size[0] : m.dimensions[0]) + 10;
    } else if (state === 'exploded') {
      position = [0, 0, z - component.placement.translation[2] - m.meshMax[2]];
      z -= m.dimensions[2] + Number(p.explodedGap);
    }
    return {
      component,
      label: m.label,
      color:
        m.route === 'sheet'
          ? 0x353c43
          : m.route === 'print'
            ? 0x448b87
            : m.route === 'soft'
              ? 0x25282b
              : 0x8c949b,
      position,
      preserveLibraryAppearance: true,
    };
  });
}
export const geometry = (p: Parameters, state: string) =>
  componentGeometry([componentPart], pieces(p, state));
export const python = (p: Parameters, state: string) =>
  componentPython([componentPart], pieces(p, state));
export function dimensions(p: Parameters, state: string): [number, number, number] {
  const g = geometry(p, state);
  try {
    g.updateMatrixWorld(true);
    return new Box3().setFromObject(g, true).getSize(new Vector3()).toArray() as [
      number,
      number,
      number,
    ];
  } finally {
    disposeModel(g);
  }
}
