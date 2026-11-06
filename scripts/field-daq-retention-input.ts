import type { Parameters } from '../src/core/types';
import { detailComponent } from '../src/core/component-recipes';
import { componentPython } from '../src/core/assembly/detail-instances';
import {
  keyBody,
  keyLatch,
  keyPose,
  retentionLayout,
} from '../src/parts/field-daq-enclosure/lib/board-retention';
import { libraries } from '../src/parts/field-daq-enclosure/lib/model';

/** Source-bound release fixtures; the manufactured retainer is always the unbent key. */
export function retentionNativeInput(p: Parameters) {
  const d = retentionLayout(p);
  const fixtures = [
    { id: 'rigid-key', shape: keyBody(p) },
    { id: 'released-leaf', shape: keyLatch(p, d.latchLift) },
    { id: 'released-key', shape: keyPose(p, 0, d.latchLift) },
  ];
  return {
    layout: d,
    fixtureIds: fixtures.map((v) => v.id),
    fixtureCode: componentPython(
      libraries,
      fixtures.map((v) => ({
        component: detailComponent(v.id, v.id, v.shape, { preserveAuthoredFrame: true }),
        label: v.id,
        color: 0xa5adb0,
        requireSingleSolid: true,
      })),
    ),
    limitations:
      'Sampled rigid-body assembly paths and a prescribed leaf deflection fixture; no elastic stress, fatigue, printed fit or physical impact prediction.',
  };
}
