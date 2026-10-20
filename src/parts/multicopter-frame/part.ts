import type { PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import product from './product.json';
import { defaults, parameters } from './configurator';
import { geometry, python, dimensions, composition } from './lib/model';
import { frames, sourceFrame, assemblyPlacement } from '../multicopter-frame-component/part';
import { engineering } from './lib/engineering';
import cutting from './lib/cutting-native.json';
import originalCutting from './lib/cutting.json';

const presets: Preset[] = frames.map((f) => ({
  id: f.id,
  name: f.name,
  description: f.description,
  parameters: {
    ...defaults,
    model: f.id,
    mass: f.mass,
    motorThrust: f.motorThrust,
    rotorHeight: f.rotorHeight,
    propDiameter: f.propDiameter,
  },
  catalog: {
    designation: f.name + ' · pinned source CAD',
    manufacturer: f.name + ' project',
    sourceName: 'Original project CAD',
    sourceUrl: f.source.url,
    verifiedParameters: ['model'],
    attributes: {
      motorCount: String(f.motorCount),
      armCount: f.arms.length,
      construction: f.id === 'comet-y6' ? 'Printed PC/CF' : 'Carbon sheets',
    },
    geometryEvidence: {
      kind: 'manufacturer-cad',
      summary: `${f.parts.length} native source components. Fixed contours and thicknesses; no geometric scaling.`,
      limitations: [
        ...f.hardware,
        ...f.changes,
        'Local materials and complete-aircraft flight qualification still require verification.',
      ].join(' '),
      sourceUrl: f.source.url,
      sourceSha256: f.source.sha256,
    },
  },
}));
const part: PartDefinition = {
  id: 'multicopter-frame',
  name: 'Multicopter frame',
  browseFamily: { id: 'multicopter-frame', label: 'Multicopter frames', primary: true },
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MULTICOPTERS',
  icon: 'bracket',
  product: product as ProductProfile,
  description:
    'Open frame designs: SOURCE quads, PODRACER, COMET Y6 hexacopter and SOURCE ONE V4 X8 octocopter. Original cutting contours and printable components.',
  complexity: '6 source designs · 4 / 6 / 8 motors',
  validationNotice: 'Source geometry · flight checks pending',
  keywords: [
    'multicopter',
    'quadcopter',
    'hexacopter',
    'octocopter',
    'hexarotor',
    'octorotor',
    'Y6',
    'X8',
    'COMET',
    'coaxial',
    'source one',
    'source two',
    'source v',
    'podracer',
    'FPV',
    'carbon',
    'nylon',
    'arm root',
    'CFRP',
    'frame',
  ],
  defaults,
  parameters,
  presets,
  presetMatchKeys: ['model'],
  catalogSelection: [],
  catalogFilterFields: [
    { key: 'armCount', label: 'Arms', group: 'Configuration', type: 'number', unit: 'arms' },
    {
      key: 'motorCount',
      label: 'Motors',
      group: 'Configuration',
      type: 'select',
      options: [4, 6, 8].map((n) => ({ value: String(n), label: String(n) })),
    },
    {
      key: 'construction',
      label: 'Construction',
      group: 'Configuration',
      type: 'select',
      options: ['Carbon sheets', 'Printed PC/CF'].map((s) => ({ value: s, label: s })),
    },
  ],
  composition,
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description:
        'Source frame components at their assembly datums; hardware omissions are listed in the assessment.',
    },
    { id: 'body', label: 'Lower plate', description: 'The chosen frame lower structural plate.' },
    {
      id: 'arm',
      label: 'One arm',
      description: 'One original source arm or vertical web, without resizing.',
    },
    {
      id: 'root',
      label: 'Arm-root joint',
      description: 'Source load-bearing root plates, arms and available source hardware.',
    },
    {
      id: 'cut',
      label: 'Sheet parts',
      description: 'All source carbon sheets rotated onto the cutting plane.',
      availableWhen: (p) => sourceFrame(p.model).parts.some((m) => m.route === 'sheet'),
    },
    {
      id: 'print',
      label: 'Printed parts',
      description:
        'Source printable components; COMET parts return to their original print orientation.',
      availableWhen: (p) => sourceFrame(p.model).parts.some((m) => m.route === 'print'),
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Source frame occurrences separated for inspection.',
    },
  ],
  updateParameters(p, changedKey) {
    if (changedKey !== 'model') return p;
    const f = sourceFrame(p.model);
    return {
      ...p,
      mass: f.mass,
      motorThrust: f.motorThrust,
      propDiameter: f.propDiameter,
      rotorHeight: f.rotorHeight,
    };
  },
  validate(p, state) {
    const f = frames.find((f) => f.id === p.model);
    if (!f) return ['Choose a pinned source model.'];
    if (!['assembled', 'body', 'arm', 'root', 'cut', 'print', 'exploded'].includes(state))
      return ['Choose a valid inspection state.'];
    if (state === 'print' && !f.parts.some((m) => m.route === 'print'))
      return ['This source frame has no printable component.'];
    if (state === 'cut' && !f.parts.some((m) => m.route === 'sheet'))
      return ['This source frame uses printed components; choose Printed parts.'];
    const errors: string[] = [];
    if (Number(p.propDiameter) + 5 > f.minimumMotorSpacing)
      errors.push(
        'Propeller discs have less than 5 mm clearance at the closest source motor spacing.',
      );
    if (Number(p.rotorHeight) + f.armTop < f.deckTop + 5)
      errors.push('Propeller plane must clear the source deck or pod by at least 5 mm.');
    if (engineering(p).coaxialClearance.some((s) => s.bladeGapMm < 5))
      errors.push('Coaxial swept blade envelopes need at least 5 mm axial separation.');
    if (Number(p.mass) * 1000 < engineering(p).estimatedFrameMassG)
      errors.push('Total flying mass cannot be lower than the estimated source components alone.');
    return errors;
  },
  buildGeometry: geometry,
  dimensions,
  python,
  assessment(p) {
    const f = sourceFrame(p.model),
      r = engineering(p);
    return [
      `${f.name}: ${f.description}`,
      `${f.topology}: ${f.motorCount} motors on ${f.arms.length} arms.`,
      `Load demand: ${r.loadN.toFixed(2)} N per motor; ${r.stationLoadN.toFixed(2)} N per arm station; total flying mass ${Number(p.mass).toFixed(2)} kg; sum of isolated maximum thrust/weight ${r.thrustToWeight.toFixed(2)}. Use measured installed motor/prop/battery data.`,
      ...(r.coaxialClearance.length
        ? [
            `Coaxial swept blade gap: ${Math.min(...r.coaxialClearance.map((s) => s.bladeGapMm)).toFixed(1)} mm at equal outward propeller offsets. Disc spacing is checked between distinct stations; coaxial wake losses are not estimated.`,
          ]
        : []),
      ...(r.deflectionMm !== null && r.localStressMPa !== null && r.rootCoupleN !== null
        ? [
            `SOURCE ONE ideal rigid-root arm screen: ${r.deflectionMm.toFixed(3)} mm tip deflection; local stress estimate ${r.localStressMPa.toFixed(1)} MPa, including x${p.stressConcentration} local multiplier. Body and joint flexibility are additional.`,
            r.assumedStressMargin === null
              ? 'No verified stress allowable entered. No strength pass is assigned.'
              : `Ratio against the assumed stress allowable: ${r.assumedStressMargin.toFixed(2)}; joint and flight checks remain open.`,
            `Root moment couple demand: approximately ${r.rootCoupleN.toFixed(0)} N across the source 7.42 mm bolt spacing. Verify insert pull-through, bearing and preload retention.`,
          ]
        : [
            'No validated beam/joint calculation is assigned to this topology. Its source geometry is preserved; SOURCE ONE stiffness estimates are not reused.',
          ]),
      `Estimated mass of included CAD components: ${r.estimatedFrameMassG.toFixed(0)} g using assumed densities. Add unmodelled hardware and weigh the finished assembly.`,
      ...f.hardware,
      ...f.changes,
      'Flight checks pending: actual laminate/polymer, hardware, joint retention, whole-frame torsion, vibration and complete-aircraft proof tests.',
    ];
  },
  fabricationFiles(p) {
    const f = sourceFrame(p.model);
    const cut = (cutting as Record<string, { dxf: string }>)[f.id];
    return [
      ...(cut && f.parts.some((m) => m.route === 'sheet')
        ? [
            {
              id: 'source-cut',
              label: 'CAD-matched cutting layout',
              description: 'All carbon occurrences · mm · stock thickness labels',
              name: f.id + '-cutting.dxf',
              type: 'application/dxf',
              content: cut.dxf,
            },
          ]
        : []),
      {
        id: 'load-case',
        label: 'Load case and assembly checks',
        description: 'Inputs, source revision, hardware and assembly notes · JSON',
        name: f.id + '-load-case.json',
        type: 'application/json',
        content: JSON.stringify(engineering(p), null, 2),
      },
      {
        id: 'source-bom',
        label: 'Parts and hardware requirements',
        description: `${f.parts.length} source occurrences and author hardware notes · CSV`,
        name: f.id + '-parts.csv',
        type: 'text/csv',
        content:
          'Part,Route,Source index,Native volume mm3,Assembly Z mm\n' +
          f.parts
            .map(
              (m) =>
                `"${m.label}",${m.route},${m.sourceIndex},${m.volume},${assemblyPlacement(m)[2]}`,
            )
            .join('\n') +
          '\n\nHardware requirements\n' +
          f.hardware.map((s) => '"' + s.replaceAll('"', '""') + '"').join('\n'),
      },
      ...(f.id === 'source-one-v5'
        ? [
            {
              id: 'original-cut',
              label: 'Original V5 drawing reference',
              description: 'Upstream 2 mm label differs from this 2.5 mm CAD build',
              name: 'source-one-v5-upstream-reference.dxf',
              type: 'application/dxf',
              content: originalCutting.dxf,
            },
          ]
        : []),
    ];
  },
  notes:
    'Fixed original open-source geometry: SOURCE projects under GPL-3.0-only, COMET hardware under CERN-OHL-W-2.0. Pinned revisions, local assembly poses and modifications are documented in the component notice. SOURCE ONE hardware datums are corrected for the 2.5 mm CAD lower plate and 2 mm deck. Use native STEP for exact CAM and finish countersinks separately. Local flight qualification remains open.',
  sources: frames.map((f) => ({
    label: f.name + ' source and history',
    url: f.source.repository + '/tree/' + f.source.revision,
  })),
};
export default part;
