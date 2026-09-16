import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import presetData from './presets.json';
import { defaults, parameters } from './configurator';
import { armDirections, buildHorn, hornDimensions, hornPython } from './lib/geometry';

const part: PartDefinition = {
  id: 'servo-arm',
  name: 'Servo horn',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SERVO ACCESSORIES',
  icon: 'bracket',
  complexity: 'Serrated socket, linkage holes and optional split clamp',
  description:
    'Single, double, cross, six-arm and disc servo horns with independent socket fit and hole patterns.',
  keywords: [
    'servo',
    'arm',
    'horn',
    'horn set',
    'rocker',
    'cross',
    'disc',
    '15T',
    '23T',
    '24T',
    '25T',
    'clevis',
    'linkage',
    'Futaba',
    'PDRS60',
    'Q-XA15',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['splineTeeth', 'form', 'armLength', 'splineMajorDiameter'],
  states: [
    {
      id: 'assembled',
      label: 'Top side',
      description: 'Linkage face and central retaining-screw counterbore.',
    },
    {
      id: 'socket-up',
      label: 'Spline socket side',
      description: 'Turn over the complete horn to inspect the serrated servo socket.',
    },
  ],
  validate(p) {
    const errors: string[] = [],
      hubR = n(p, 'hubDiameter') / 2,
      holeR = n(p, 'holeDiameter') / 2;
    for (const key of ['splineTeeth', 'holeCount', 'perpendicularHoleCount', 'discHoleCount'])
      if (!Number.isInteger(n(p, key)))
        errors.push('Spline teeth and linkage-hole counts must be whole numbers.');
    if (n(p, 'hubHeight') < n(p, 'plateThickness'))
      errors.push('Total hub height must be at least the plate thickness.');
    if (n(p, 'splineMajorDiameter') <= n(p, 'splineMinorDiameter'))
      errors.push('Spline major diameter must exceed its minor diameter.');
    if (n(p, 'splineMajorDiameter') + 0.8 >= n(p, 'hubDiameter'))
      errors.push('Keep at least 0.4 mm of hub wall around the spline socket.');
    if (n(p, 'screwBore') + 0.3 >= n(p, 'splineMinorDiameter'))
      errors.push('Central screw bore must remain smaller than the spline socket.');
    if (n(p, 'counterboreDiameter') < n(p, 'screwBore'))
      errors.push('The counterbore must be at least as wide as the screw bore.');
    if (n(p, 'counterboreDiameter') + 0.6 >= n(p, 'hubDiameter'))
      errors.push('The counterbore needs material around the hub edge.');
    if (n(p, 'socketDepth') + n(p, 'counterboreDepth') + 0.3 >= n(p, 'hubHeight'))
      errors.push('Retain a solid screw seat between the socket and top counterbore.');
    if (p.form === 'disc') {
      if (n(p, 'discPitchDiameter') / 2 - holeR <= hubR + 0.2)
        errors.push('Disc holes must clear the hub.');
      if (n(p, 'discPitchDiameter') + n(p, 'holeDiameter') + 0.6 >= n(p, 'armLength'))
        errors.push('Disc holes must remain inside the outer edge.');
      if (
        n(p, 'discPitchDiameter') * Math.sin(Math.PI / n(p, 'discHoleCount')) <=
        n(p, 'holeDiameter') + 0.2
      )
        errors.push('Adjacent disc holes need material between them.');
    } else {
      if (n(p, 'armWidth') < n(p, 'tipWidth'))
        errors.push('Arm root width must be at least the tip width.');
      if (n(p, 'tipWidth') < n(p, 'holeDiameter') + 0.8)
        errors.push('Arm tips need at least 0.4 mm of material beside a linkage hole.');
      for (const a of armDirections(p)) {
        if (a.reach <= hubR + n(p, 'tipWidth') / 2)
          errors.push('The overall arm length must extend beyond the hub.');
        if (a.start - holeR <= hubR + 0.1)
          errors.push('The first linkage hole must clear the hub.');
        if (a.start + (a.count - 1) * a.spacing + holeR + 0.2 >= a.reach)
          errors.push('Linkage holes must remain inside their rounded arm tip.');
        if (a.count > 1 && a.spacing <= n(p, 'holeDiameter') + 0.2)
          errors.push('Keep material between adjacent linkage holes.');
      }
    }
    if (p.clamp) {
      if (p.form !== 'single') errors.push('The split clamp is available on single-arm horns.');
      if (n(p, 'clampExtension') <= n(p, 'clampScrewDiameter') + 0.6)
        errors.push('Increase the clamp extension to enclose the transverse screw hole.');
      if (n(p, 'clampScrewDiameter') * 1.7 + 0.2 >= n(p, 'hubHeight'))
        errors.push('Clamp screw head must fit within the total hub height.');
      if (n(p, 'clampWidth') <= n(p, 'clampSlit') + 2)
        errors.push('The clamp slit must leave material in both ears.');
    }
    return [...new Set(errors)];
  },
  buildGeometry: buildHorn,
  python: hornPython,
  dimensions: (p) => hornDimensions(p),
  updateParameters(p, changedKey) {
    if (changedKey === 'clamp' && p.form === 'single')
      return { ...p, armLength: n(p, 'armLength') + (p.clamp ? 1 : -1) * n(p, 'clampExtension') };
    if (changedKey === 'form') {
      const updated = { ...p, clamp: p.form === 'single' ? p.clamp : false };
      if (p.form === 'disc')
        return {
          ...updated,
          armLength: Math.max(
            n(p, 'armLength'),
            n(p, 'discPitchDiameter') + n(p, 'holeDiameter') + 2,
          ),
        };
      const reach =
        n(p, 'firstHoleRadius') +
        (n(p, 'holeCount') - 1) * n(p, 'holeSpacing') +
        n(p, 'tipWidth') / 2;
      const perpendicularFirstHole = Math.max(
        n(p, 'perpendicularFirstHole'),
        n(p, 'hubDiameter') / 2 + n(p, 'holeDiameter') / 2 + 0.4,
      );
      const perpendicularReach =
        perpendicularFirstHole +
        (n(p, 'perpendicularHoleCount') - 1) * n(p, 'perpendicularHoleSpacing') +
        n(p, 'tipWidth') / 2;
      return {
        ...updated,
        armLength: Math.max(
          n(p, 'armLength'),
          p.form === 'single' ? reach + n(p, 'hubDiameter') / 2 : reach * 2,
        ),
        perpendicularFirstHole,
        perpendicularLength: Math.max(n(p, 'perpendicularLength'), perpendicularReach * 2),
      };
    }
    return p;
  },
  notes:
    'All dimensions are millimetres. Socket tooth count and both diameters are independent; a 23T, 24T or 25T label does not guarantee fit. Straight-flank socket serrations are a prototype approximation, not a manufacturer spline specification. Linkage and clamp bores are smooth; drawing thread callouts are recorded in source details. Only explicitly listed source dimensions are verified; other preset dimensions are editable prototype values. Clamp screws export as separate FreeCAD components.',
  sources: [
    { label: 'Supplied anodized arm examples', url: '' },
    { label: 'Supplied servo horn set dimensions', url: '' },
    { label: 'Supplied PDRS60 15T drawing', url: '' },
    { label: 'Supplied 25T clamping arm drawing', url: '' },
  ],
};
export default part;
