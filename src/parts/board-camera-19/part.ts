import { Group } from 'three';
import type { PartDefinition, Parameters, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { n } from '../../core/geometry';
import {
  box,
  cylinder,
  union,
  subtract,
  component,
  pythonShape,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { defaults, parameters } from './configurator';
import product from './product.json';
import presets from './presets.json';

export function cameraShape(p: Parameters): Shape {
  let body: Shape = union(
    box(
      [n(p, 'bodyWidth'), n(p, 'bodyHeight'), n(p, 'bodyDepth')],
      [-n(p, 'bodyWidth') / 2, -n(p, 'bodyHeight') / 2, 0],
    ),
    cylinder(n(p, 'lensDiameter') / 2, n(p, 'lensLength'), [0, 0, n(p, 'bodyDepth')]),
    ...(p.lensProfile === 'stepped'
      ? [
          cylinder(n(p, 'lensCollarDiameter') / 2, n(p, 'lensCollarHeight'), [
            0,
            0,
            n(p, 'bodyDepth'),
          ]),
        ]
      : []),
  );
  if (p.rearInterface === 'rear-mipi') {
    const width = n(p, 'rearConnectorWidth'),
      height = n(p, 'rearConnectorHeight'),
      projection = n(p, 'rearConnectorProjection');
    body = union(
      body,
      box(
        [width, height, projection + 0.02],
        [
          n(p, 'bodyWidth') / 2 - n(p, 'rearConnectorRightInset') - width,
          n(p, 'bodyHeight') / 2 - n(p, 'rearConnectorTopInset') - height,
          -projection,
        ],
      ),
    );
  }
  if (p.sideMount === 'm2.5') {
    const half = n(p, 'bodyWidth') / 2,
      depth = n(p, 'sideHoleDepth'),
      offset = n(p, 'sideMountOffset');
    body = subtract(
      body,
      cylinder(1.25, depth + 0.02, [-half - 0.02, 0, offset], 'x'),
      cylinder(1.25, depth + 0.02, [half - depth, 0, offset], 'x'),
    );
  }
  return body;
}

const part: PartDefinition = {
  id: 'board-camera-19',
  name: '19x19 CSI board camera',
  category: 'ELECTRONICS & VISION',
  subgroup: 'CAMERAS & VISION',
  icon: 'camera',
  complexity: 'User camera envelope / optional rear MIPI and M2.5 mounts',
  description:
    'A configurable 19 x 19 x 12 mm CSI camera reference, with optional user-positioned rear MIPI latch and left/right M2.5 mounting envelopes.',
  keywords: [
    'RunCam',
    'RunCam size',
    'IMX577',
    '19x19',
    '19 x 19',
    '19x19x27',
    'CSI camera',
    'rear MIPI',
    'M2.5 side mount',
    'Raspberry Pi camera',
    'board camera',
    'FPV camera',
    'nose cone',
    'LDRS',
  ],
  product: product as ProductProfile,
  parameters,
  defaults,
  presets: presets as Preset[],
  catalogSelection: [],
  presetMatchKeys: [
    'bodyWidth',
    'bodyHeight',
    'bodyDepth',
    'lensProfile',
    'lensDiameter',
    'lensLength',
    'lensCollarDiameter',
    'lensCollarHeight',
    'rearInterface',
    'sideMount',
    'sideMountOffset',
  ],
  identityParameters(p) {
    if (p.lensProfile !== 'cylindrical') return { ...p };
    const {
      lensProfile: _profile,
      lensCollarDiameter: _diameter,
      lensCollarHeight: _height,
      ...physical
    } = p;
    return physical;
  },
  validate(p) {
    const errors = parameters
      .filter(
        (f) =>
          f.type === 'number' &&
          (typeof p[f.key] !== 'number' ||
            !Number.isFinite(p[f.key]) ||
            +p[f.key] < f.min! ||
            +p[f.key] > f.max!),
      )
      .map((f) => `${f.label} is outside its supported finite range.`);
    if (errors.length) return errors;
    if (n(p, 'lensDiameter') > Math.min(n(p, 'bodyWidth'), n(p, 'bodyHeight')))
      errors.push('The objective envelope must fit within the smaller body width or height.');
    if (!['cylindrical', 'stepped'].includes(String(p.lensProfile)))
      errors.push('Choose the cylindrical or stepped objective profile.');
    if (p.lensProfile === 'stepped') {
      if (n(p, 'lensCollarHeight') <= 0 || n(p, 'lensCollarHeight') > n(p, 'lensLength'))
        errors.push(
          'The lower collar must have positive height within the complete objective projection.',
        );
      if (
        n(p, 'lensCollarDiameter') < n(p, 'lensDiameter') ||
        n(p, 'lensCollarDiameter') > Math.min(n(p, 'bodyWidth'), n(p, 'bodyHeight'))
      )
        errors.push(
          'The lower collar must enclose the front objective and fit within the body cross-section.',
        );
    }
    if (!['none', 'rear-mipi'].includes(String(p.rearInterface)))
      errors.push('Choose the generic rear face or the rear MIPI envelope.');
    if (!['none', 'm2.5'].includes(String(p.sideMount)))
      errors.push('Choose the generic body or the left/right M2.5 mounting interface.');
    if (p.rearInterface === 'rear-mipi') {
      if (n(p, 'rearConnectorWidth') + n(p, 'rearConnectorRightInset') > n(p, 'bodyWidth'))
        errors.push('The rear connector width and right inset must fit inside the body width.');
      if (n(p, 'rearConnectorHeight') + n(p, 'rearConnectorTopInset') > n(p, 'bodyHeight'))
        errors.push('The rear connector height and top inset must fit inside the body height.');
    }
    if (p.sideMount === 'm2.5') {
      const offset = n(p, 'sideMountOffset');
      if (offset <= 1.25 || offset + 1.25 >= n(p, 'bodyDepth'))
        errors.push('Keep the complete M2.5 side reference bores inside the body depth.');
      if (n(p, 'sideHoleDepth') >= n(p, 'bodyWidth') / 2)
        errors.push('Each blind side-hole depth must remain below half the body width.');
    }
    return errors;
  },
  buildGeometry: (p) => new Group().add(component(cameraShape(p), 'CSI camera envelope', 0x353b42)),
  python: (p) => `shape = ${pythonShape(cameraShape(p))}`,
  dimensions: (p) => [
    n(p, 'bodyWidth'),
    n(p, 'bodyHeight'),
    n(p, 'bodyDepth') +
      n(p, 'lensLength') +
      (p.rearInterface === 'rear-mipi' ? n(p, 'rearConnectorProjection') : 0),
  ],
  assessment: (p) => [
    `Body ${p.bodyWidth} x ${p.bodyHeight} x ${p.bodyDepth} mm; objective projection ${p.lensLength} mm. Body rear is Z=0 and the optical axis points +Z.`,
    p.lensProfile === 'stepped'
      ? `User-measured front objective Ø${p.lensDiameter} mm; body-adjacent collar Ø${p.lensCollarDiameter} × ${p.lensCollarHeight} mm. The collar is included within the total objective projection.`
      : `Cylindrical objective Ø${p.lensDiameter} mm; the generic Ø12 reference remains an assumption.`,
    p.rearInterface === 'rear-mipi'
      ? `Rear MIPI envelope ${p.rearConnectorWidth} x ${p.rearConnectorHeight} mm projects ${p.rearConnectorProjection} mm toward -Z; top inset ${p.rearConnectorTopInset} mm, right inset ${p.rearConnectorRightInset} mm.`
      : 'Generic reference preserves the rear Z=0 face without a separate connector projection.',
    p.sideMount === 'm2.5'
      ? `Left/right M2.5 reference bores are centered at Y=0, Z=${p.sideMountOffset} mm from the rear. Blind depth ${p.sideHoleDepth} mm is an authored assumption, not verified thread engagement.`
      : 'Generic reference has no mounting holes. Use an envelope clamp until the actual mounting interface is selected.',
  ],
  notes:
    'Mechanical reference based on the user-provided 19 x 19 x 12 mm body and 15 mm objective projection. The generic objective diameter is an editable 12 mm assumption; the measured IMX577 execution uses a 14.8 mm front diameter and a 16 mm lower collar over 5 mm, within the unchanged 15 mm projection. Z=0 is the rear body face and the optical axis points +Z. The generic default has no side holes or separate rear connector and preserves the original 27 mm envelope. The optional interface preset uses user-confirmed left/right M2.5 holes 7.5 mm from the rear and a rear MIPI latch approximately 17 x 2 mm with 0.5 mm rear projection and 3 mm top-edge inset. Side-hole Y=0, right-edge inset 0 and blind depth 2.5 mm are authored fitting assumptions. Smooth major-diameter M2.5 bores are Simple thread references, not tap-drill or verified internal-thread geometry. An assumed 2 mm screw engagement leaves 0.5 mm bottom allowance in the default blind-hole envelope; actual depth and internal obstructions require measurement. The latch overlaps 0.02 mm into the body solely to form one solid without changing its outside envelope. CSI is the requested interface. The user confirms IMX577 only for the exact imx577-19x19-rear-mipi-m25 reference; the generic reference assigns no sensor. Module supplier SKU, pin count, cable and Raspberry Pi 5 electrical compatibility remain unidentified. RunCam describes the size reference, not an assertion that an analog RunCam module is a CSI camera.',
};

export default part;
