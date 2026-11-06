import { detailComponent } from '../../../core/component-recipes';
import { union } from '../../../core/assembly/boundary/shapes';
import { cncFramePieces, cncMiddleShape, guideShape, centralGuideLayout, type CncLayout } from '../../tr8-quad-cnc-actuator/part';

/** All original frame interfaces remain; only the middle body gains guide stock. */
export function guidedFramePieces(layout: CncLayout) {
  return cncFramePieces(layout).map(piece => {
    if (piece.component.id !== 'cnc-middle-body') return piece;
    const label = `CNC middle body · Ø${layout.diameter} · four integral central nut guides`;
    const component = detailComponent(piece.component.id, label, union(cncMiddleShape(layout), guideShape(layout)));
    const guide = centralGuideLayout(layout);
    component.manufacturing = {
      ...piece.component.manufacturing!,
      requirements: [...piece.component.manufacturing!.requirements,
        'Mill the square central spine and four pinwheel guide fins integrally with the existing middle body.',
        `Guide fins are ${guide.finThickness} mm thick; finish their four sliding faces for a nominal ${guide.runningGap} mm carrier clearance.`,
        'Keep the guide and carrier flats parallel to each screw axis. Assign actual flatness, alignment, surface finish and sliding-fit tolerances together.',
        'Deburr and lubricate the sliding faces. Verify fin/root stiffness and wear under the intended nut reaction torque.',
        'The guide ends before the end disc and adds no through slots, fasteners or extra main discs.',
      ],
    };
    return { ...piece, component, label };
  });
}
