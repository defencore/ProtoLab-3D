import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import { pistonValues, pistonComponents } from './lib/piston';
import { assemblyBounds, assemblyGeometry, assemblyPython } from './lib/solids';
import presetData from './presets.json';

const part: PartDefinition = {
  id: 'piston',
  name: 'Piston',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'PISTONS & CONNECTING RODS',
  icon: 'bearing',
  complexity: 'Hollow skirt, split rings, wrist pin and clips / pneumatic disk',
  description:
    'Compressor and engine piston assemblies with independent rings and wrist pin; pneumatic disk with axial rod bore and seals.',
  keywords: [
    'piston',
    'compressor',
    'engine',
    'combustion',
    'cylinder',
    'pneumatic',
    'wrist pin',
    'gudgeon pin',
    'connecting rod',
    'skirt',
    'compression height',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['variant', 'nominalBore', 'height', 'pinDiameter', 'rodBore'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description:
        'Piston body with fitted split rings, hollow wrist pin and clips, or uncompressed pneumatic seals.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate rings, pin and clips to inspect the independent physical parts.',
    },
    {
      id: 'body',
      label: 'Body only',
      description: 'Piston body with grooves, mounting bores and internal bosses.',
    },
  ],
  validate(p) {
    const v = pistonValues(p),
      errors: string[] = [],
      gw = n(p, 'grooveWidth'),
      depth = n(p, 'grooveDepth'),
      bottomGroove = v.grooveCenters.at(-1)! - gw / 2;
    if (!Number.isInteger(n(p, 'grooveCount')))
      errors.push('The ring or seal count must be a whole number.');
    if (n(p, 'diametralClearance') >= n(p, 'nominalBore') * 0.1)
      errors.push('Running clearance must remain below 10% of the nominal size.');
    if (bottomGroove < 1) errors.push('Ring grooves must leave at least 1 mm of bottom land.');
    if (n(p, 'grooveCount') > 1 && n(p, 'groovePitch') <= gw + 0.6)
      errors.push('Grooves need at least 0.6 mm of axial land between them.');
    if (n(p, 'ringRadialClearance') >= depth - 0.2)
      errors.push('Ring / seal back clearance must leave at least 0.2 mm of radial engagement.');
    if (depth >= v.radius - 1) errors.push('Grooves must leave a continuous inner body.');
    if (p.variant === 'pneumatic') {
      if (n(p, 'rodBore') / 2 + 1 >= v.radius - depth)
        errors.push('The rod bore must leave material beneath the seal grooves.');
      if (n(p, 'sealSection') + 0.1 >= gw)
        errors.push('The groove must be wider than the uncompressed seal section.');
      if (depth >= n(p, 'sealSection'))
        errors.push('The seal section must project beyond the body surface.');
    } else {
      if (v.wall <= depth + Math.min(0.8, n(p, 'nominalBore') / 40))
        errors.push(
          'Increase skirt wall thickness or reduce groove depth to retain the inner wall.',
        );
      if (v.innerRadius <= 1 || n(p, 'crownThickness') >= v.height - 2)
        errors.push('The skirt must retain an open internal cavity beneath the crown.');
      if (p.crown === 'dished') {
        if (n(p, 'dishDepth') >= n(p, 'crownThickness') - 0.8)
          errors.push('The crown dish must leave at least 0.8 mm of solid crown.');
        if (n(p, 'dishDiameter') >= 2 * v.radius - 2)
          errors.push('The crown dish must remain inside the piston perimeter.');
      }
      if (n(p, 'ringSideClearance') * 2 >= gw - 0.3)
        errors.push('Side clearance must leave a positive ring axial thickness.');
      if (n(p, 'pinInnerDiameter') >= n(p, 'pinDiameter') - 1)
        errors.push('The hollow wrist pin must retain at least 0.5 mm of radial wall.');
      if (n(p, 'bossDiameter') <= 2 * (v.clipOuter + n(p, 'clipGrooveClearance') + 0.8))
        errors.push('Pin bosses must retain material outside the clip groove.');
      if (v.pinZ - n(p, 'bossDiameter') / 2 < 0.8)
        errors.push('Pin bosses must leave a continuous lower skirt rim.');
      if (v.pinZ + n(p, 'bossDiameter') / 2 > v.height - n(p, 'crownThickness') - 0.5)
        errors.push('Pin bosses must fit below the inner crown.');
      if (v.pinZ + (n(p, 'pinDiameter') + n(p, 'pinBoreClearance')) / 2 >= bottomGroove - 0.6)
        errors.push('The wrist-pin bore must clear the lowest ring groove.');
      if (v.bossGap < 2) errors.push('The inner boss faces must leave space for a connecting rod.');
      if (n(p, 'pinLength') / 2 <= v.bossGap / 2 + 1)
        errors.push('The wrist pin must engage both internal bosses.');
      if (
        Math.hypot(
          v.clipX + n(p, 'clipThickness') / 2 + n(p, 'clipGrooveClearance'),
          v.clipOuter + n(p, 'clipGrooveClearance'),
        ) >=
        v.radius - 0.3
      )
        errors.push('Pin and clip grooves must fit inside the cylindrical skirt envelope.');
      if (n(p, 'clipRadialWidth') >= n(p, 'pinDiameter') * 0.3)
        errors.push('Clip radial width must remain below 30% of the pin diameter.');
    }
    return errors;
  },
  buildGeometry: (p, s) => assemblyGeometry(pistonComponents(p, s)),
  python: (p, s) => assemblyPython(pistonComponents(p, s)),
  dimensions(p, s) {
    const bounds = assemblyBounds(pistonComponents(p, s));
    return bounds[1].map((v, i) => v - bounds[0][i]) as [number, number, number];
  },
  updateParameters(p, key) {
    if (key !== 'variant') return p;
    const scale = n(p, 'nominalBore') / 65;
    const scaled = Object.fromEntries(
      Object.entries(defaults).map(([field, value]) => [
        field,
        typeof value === 'number' && !['grooveCount', 'ringGap', 'clipGap'].includes(field)
          ? Math.min(
              parameters.find((parameter) => parameter.key === field)?.max ?? Infinity,
              Math.max(
                parameters.find((parameter) => parameter.key === field)?.min ?? 0,
                Number((value * scale).toFixed(4)),
              ),
            )
          : value,
      ]),
    );
    if (p.variant === 'pneumatic') {
      const section = Math.max(1, Math.min(2.5, n(p, 'nominalBore') * 0.06));
      return {
        ...p,
        height: section * 8,
        grooveCount: 2,
        topLand: section * 1.2,
        grooveWidth: section * 1.2,
        groovePitch: section * 4.4,
        grooveDepth: section * 0.72,
        sealSection: section,
        rodBore: Math.min(12, n(p, 'nominalBore') * 0.3),
        ringRadialClearance: Math.min(0.15, section * 0.06),
      };
    }
    return {
      ...p,
      ...scaled,
      variant: p.variant,
      crown: p.variant === 'engine' ? 'dished' : 'flat',
      nominalBore: p.nominalBore,
      diametralClearance: p.diametralClearance,
      showRings: p.showRings,
      showPin: p.showPin,
      showClips: p.showClips,
    };
  },
  notes:
    'Listing sizes are nominal labels, used as editable cylinder-layout dimensions. Finished skirt diameter equals nominal size minus diametral clearance; the source does not establish running fit, alloy, tolerances, thermal growth or pressure rating. Compressor/engine bodies have an open skirt, pin bosses and a solid crown. Rings and clips have rectangular prototype profiles; pneumatic seals are uncompressed circular O-rings. Grooves and bores are smooth; no oil drains, asymmetric skirt, valve pockets or production sealing profile is inferred. Every displayed physical item exports as an independent FreeCAD solid.',
  sources: [
    {
      label: 'Supplied compressor nominal size choices',
      url: '',
    },
    { label: 'Supplied piston / rod assembly anatomy', url: '' },
  ],
};
export default withParameterStates(part, {
  body: [
    'showRings',
    'ringSideClearance',
    'ringRadialClearance',
    'ringProtrusion',
    'ringGap',
    'pinInnerDiameter',
    'showPin',
    'clipGap',
    'showClips',
  ],
});
