import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'chf-gf5560-180',
  name: 'CHIHAI GF5560-180 worm gear motor',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'DC & INDUSTRIAL MOTORS',
  icon: 'gear',
  description:
    'Flat 55 × 60 × 19 mm gearmotor with a 180-size DC motor, removable cover, Ø8 D-shaft and four-stage worm/spur mechanism.',
  complexity: 'Source dimensions · reconstructed internals',
  keywords: [
    'CHIHAI',
    'CHF-GF5560-180',
    'GF5560',
    '180 motor',
    'flat worm gearbox',
    'turntable',
    'revolving table',
    'geared motor',
    'worm gearbox',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  catalogFilterFields: [
    { key: 'voltage', label: 'Supply voltage', type: 'number', unit: 'V', group: 'Electrical' },
    { key: 'ratio', label: 'Reduction ratio', type: 'number', unit: ':1', group: 'Transmission' },
    { key: 'noLoadRpm', label: 'No-load speed', type: 'number', unit: 'rpm', group: 'Performance' },
    { key: 'ratedRpm', label: 'Rated speed', type: 'number', unit: 'rpm', group: 'Performance' },
    {
      key: 'ratedTorqueKgfCm',
      label: 'Rated torque',
      type: 'number',
      unit: 'kgf·cm',
      group: 'Performance',
    },
    {
      key: 'winding',
      label: 'Motor winding',
      type: 'select',
      group: 'Electrical',
      options: ['12 V High Torque', '6 V High Torque', '12 V Standard', '24 V Standard'].map(
        (value) => ({ value, label: value }),
      ),
    },
  ],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Complete covered gearmotor or lightweight fit model.',
    },
    {
      id: 'open',
      label: 'Cover removed',
      description: 'Inspect the reconstructed worm and compound spur stages.',
    },
    {
      id: 'mechanism',
      label: 'Mechanism only',
      description: 'Motor, worm, compound gears, pins and output shaft.',
    },
    {
      id: 'exploded',
      label: 'Exploded assembly',
      description: 'Housing, cover and gears separated along the output axis.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'open', 'mechanism', 'exploded'].includes(state))
      errors.push('Select a valid model view.');
    if (+p.flatThickness <= +p.shaftDiameter / 2 || +p.flatThickness >= +p.shaftDiameter)
      errors.push(
        'D-flat thickness must be greater than the shaft radius and less than its diameter.',
      );
    if (p.shaftProfile === 'shouldered-d' && +p.flatLength >= +p.shaftLength - 1)
      errors.push('Leave at least 1 mm of round shoulder below the D-flat.');
    return errors;
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  notes:
    'External dimensions use the supplied 55 × 60 × 19 mm drawings: four Ø3.6 mounting holes, Ø8 shaft with 7 mm D-flat thickness and 21 mm projection, Ø12 × 1 mm output boss, 32 mm motor can and 4 mm brush cap. All stock presets use the published 15 mm flat with a round shoulder. The full-length flat is an optional custom geometry. Gear counts, internal tooth profiles, wall thickness, pins, sleeve bearings, screws and motor cross-section are a reconstruction for layout and inspection, not manufacturer CAD. The representative gear train does not reproduce each catalog reduction ratio, and shaft orientation only clocks the output flat. Voltage, winding and ratio are catalog specifications, not geometry controls; identical housings may have different performance. Published kgf·cm torque values are retained because some source N·m conversions conflict. Threads and motor internals are simplified. Terminals extend 2.1 mm beyond the 55 mm body width. Changed shaft dimensions describe a custom variant.',
  sources: [
    {
      label: 'CHIHAI · CHF-GF5560-180 D-shaft gearmotor',
      url: 'https://www.chihaimotor.com/wgjs/765.html',
    },
    {
      label: 'Supplied product listing · drawings and performance tables',
      url: 'https://www.aliexpress.com/item/1005006022832826.html',
    },
  ],
};
export default part;
