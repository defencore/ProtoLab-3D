import { Euler, Matrix4, Vector3 } from 'three';
import type { Parameters } from '../../../core/types';
import type { AssemblyComponent, ProductPlacement } from '../../../core/product-types';
import type { Vec } from '../../../core/assembly/boundary/shapes';
import axis, { precisionAxisParameters } from '../../cnc-precision-axis/part';
import { precisionScrewSource, type PrecisionScrewModel } from '../../cnc-precision-nut/part';
import encoder, { encoderParameters, encoderSpec } from '../../cnc-linear-encoder/part';

export const purchasedKitLibraries = [axis];
function placementMatrix(p: ProductPlacement) {
  return new Matrix4()
    .makeRotationFromEuler(
      new Euler(...(p.rotation.map((value) => (value * Math.PI) / 180) as Vec), 'ZYX'),
    )
    .setPosition(new Vector3(...p.translation));
}
const clean = (value: number) => (Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(10)));
function localPlacement(child: ProductPlacement, parent: ProductPlacement): ProductPlacement {
  const local = placementMatrix(parent).invert().multiply(placementMatrix(child));
  const rotation = new Euler().setFromRotationMatrix(local, 'ZYX');
  return {
    translation: new Vector3().setFromMatrixPosition(local).toArray().map(clean) as Vec,
    rotation: [rotation.x, rotation.y, rotation.z].map((value) =>
      clean((value * 180) / Math.PI),
    ) as Vec,
  };
}

/** Keep physical leaves separately placed; purchase each complete matched kit exactly once. */
export function groupMillingPurchasedKits(
  physical: readonly AssemblyComponent[],
): AssemblyComponent[] {
  const claimed = new Set<string>(),
    replacements = new Map<string, AssemblyComponent>();
  const find = (id: string) => {
    const matches = physical.filter((component) => component.id === id);
    if (matches.length !== 1) throw new Error('Expected one installed kit member: ' + id);
    return matches[0];
  };
  const group = (parent: AssemblyComponent, members: AssemblyComponent[]) => {
    parent.children = members.map((member) => ({
      ...member,
      placement: localPlacement(member.placement, parent.placement),
      procurement: {
        ...parent.procurement!,
        designation: parent.procurement!.designation + ' / included ' + member.name,
      },
      notes: [
        member.notes,
        'Supplied by the parent kit order; do not purchase an additional complete kit.',
      ]
        .filter(Boolean)
        .join(' '),
      children: [],
    }));
    members.forEach((member) => claimed.add(member.id));
    replacements.set(members[0].id, parent);
  };
  for (const name of ['y', 'x', 'z'] as const) {
    const shaft = find(name + '-drive-screw'),
      nut = find(name + '-ball-nut');
    const model = shaft.parameters.model as PrecisionScrewModel;
    const flange = localPlacement(nut.placement, shaft.placement).translation[0];
    const parameters = precisionAxisParameters(
      model,
      Number(shaft.parameters.racewayLength),
      Number(shaft.parameters.driveExtension),
      flange,
      name === 'z',
    );
    group(
      {
        id: name + '-matched-ballscrew-kit',
        libraryId: axis.id,
        parameters,
        state: 'default',
        quantity: 1,
        placement: shaft.placement,
        name: name.toUpperCase() + ' factory-matched ground shaft and FDI nut',
        supply: 'purchased',
        procurement: {
          manufacturer: 'HIWIN',
          source: precisionScrewSource,
          designation: `HIWIN ${model.toUpperCase()} / ${Number(parameters.racewayLength)} mm raceway / axis ${name.toUpperCase()} matched set; requested C3 and3% preload; approved custom ends required`,
        },
        notes:
          'One complete shaft/nut order with common serial pairing. Requested grade/preload are acceptance requirements, not delivered certificates.',
      },
      [shaft, nut],
    );
    const scale = find(name + '-linear-scale'),
      head = find(name + '-linear-readhead');
    const spec = encoderSpec(scale.parameters);
    group(
      {
        id: name + '-linear-encoder-kit',
        libraryId: encoder.id,
        parameters: encoderParameters(String(scale.parameters.model)),
        state: 'default',
        presetId: String(scale.parameters.model),
        quantity: 1,
        placement: scale.placement,
        name: name.toUpperCase() + ' ' + spec.designation,
        supply: 'purchased',
        procurement: {
          manufacturer: 'HEIDENHAIN',
          source: spec.source,
          designation: spec.designation,
        },
        notes:
          'One factory LS477 order includes its housing and readhead. The matching MSL41 spar is a separate purchase.',
      },
      [scale, head],
    );
  }
  return physical.flatMap((component) =>
    replacements.has(component.id)
      ? [replacements.get(component.id)!]
      : claimed.has(component.id)
        ? []
        : [component],
  );
}
