import { jaynesHinged, rotating } from './lib/kinematics';
import { jaynesLayout, jaynesLinkage } from './lib/jaynes';
import { mechanismOptions, linked, paired, linkage } from './lib/kinematics';
import { withParameterStates } from '../../core/parameter-states';
import type { PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presets from './presets.json';
import { pieces, layout } from './lib/model';
import * as assembly from './lib/assembly';
const part: PartDefinition = {
  id: 'rocket-airbrakes',
  name: 'Rocket AirBrakes',
  category: 'VEHICLE STRUCTURES',
  subgroup: 'MODEL ROCKETS',
  icon: 'gear',
  description:
    'Eleven airbrake variants, including Ben Jaynes V1–V5: hinged flaps, articulated links, sliding cams and rotating leaves. Ø80/76 default, larger presets and editable tube sizes.',
  complexity: 'Eleven variants · synchronized deployment',
  keywords: [
    'rocket',
    'airbrakes',
    'air brakes',
    'Waterloo',
    'Ben Jaynes',
    'V1 V2 V3 V4 V5',
    'Armaan Sengupta',
    'spiral cam',
    '80/76',
    '90/86',
    'cam',
  ],
  defaults,
  parameters,
  presets: presets as Preset[],
  states: [
    {
      id: 'assembled',
      label: 'Assembly',
      description: 'Complete tube with openings matched to the selected blade mechanism.',
    },
    {
      id: 'cutaway',
      label: 'Housing cutaway',
      description: 'Quarter of the tube and upper cap removed to inspect the mechanism.',
    },
    {
      id: 'open',
      label: 'Tube removed',
      description: 'Bulkheads, support frame and operating airbrakes.',
    },
    {
      id: 'mechanism',
      label: 'Mechanism only',
      description: 'Drive, cam, guides, carriages and blades.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    if (!['assembled', 'cutaway', 'open', 'mechanism'].includes(state))
      errors.push('Select a valid model view.');
    if (!['standard', 'micro'].includes(String(p.servo)))
      return [...errors, 'Select a servo installation size.'];
    if (+p.tubeOD - +p.tubeID < 1 || +p.tubeOD - +p.tubeID > 12)
      errors.push('Tube wall thickness must be between 0.5 and 6 mm.');
    if (!mechanismOptions.some((v) => v.value === p.mechanism))
      return [...errors, 'Select a valid airbrake mechanism.'];
    if (jaynesHinged(p)) {
      const j = jaynesLayout(p);
      if (j.z - j.length < 5 || j.z + j.radius - j.hinge + 12 > +p.height)
        errors.push('Increase module height or shorten the flaps to clear the end bulkheads.');
      if (+p.bladeWidth + 16 > +p.tubeID) errors.push('Reduce flap width to clear hinge hardware.');
      const gearY = j.v1 ? +p.bladeWidth + 8 : +p.bladeWidth / 2 + 9;
      if (!j.v2 && (j.hinge < 8 || Math.hypot(j.hinge * (2 + 2 / 24), gearY) > j.radius))
        errors.push('Reduce flap width or increase tube diameter to clear the transverse gears.');
      if (j.v1 && p.servo !== 'micro')
        errors.push('V1 uses the transverse micro-servo installation.');
      if (j.v2 && j.z - 26 - j.servo[2] < 5)
        errors.push('Increase height to clear the vertical servo.');
      if (j.v2 && jaynesLinkage({ ...p, deployment: 100 }).error > 1e-6)
        errors.push('The requested sweep exceeds the articulated linkage reach.');
      if (
        !j.v2 &&
        Math.hypot((j.v1 ? j.hinge : 0) + j.servo[1] / 2, j.servo[2] - (j.v1 ? 0 : 8)) >
          j.radius - 1
      )
        errors.push('The transverse servo envelope does not fit inside the tube.');
      return errors;
    }
    const m = layout(p);
    if (linked(p) && (linkage(p).crank < 8.05 || linkage(p).crank > m.followerStart - 6.3))
      errors.push(
        'Linkage pivot hardware needs more clearance: adjust travel or servo sweep, or increase tube diameter.',
      );
    if (linked(p) && Math.abs(linkage(p).achievable - +p.stroke) > 0.001)
      errors.push('Requested travel is beyond the linkage reach.');
    if (state !== 'mechanism' && paired(p) && +p.height < m.deck + 45)
      errors.push('Two-level mechanisms need additional module height.');
    if (p.mechanism === 'rack-pinion') {
      const r = +p.stroke / ((+p.sweep * Math.PI) / 180);
      if (r < 6.6 || r * 1.1 > m.followerStart - 6)
        errors.push(
          'Choose travel and servo sweep that leave room for the pinions and drive bore.',
        );
    }
    if (state !== 'mechanism' && +p.height < m.deck + 25)
      errors.push('Increase module height to clear the cam and follower hardware.');
    if (!rotating(p) && m.followerStart + +p.stroke + 5 > m.railEnd - 3.5)
      errors.push(
        'Blade travel exceeds the supported guide length; increase tube diameter or reduce travel.',
      );
    if (!rotating(p) && m.followerStart + +p.stroke + 5 > m.camRadius)
      errors.push('Leave at least 1.35 mm of material outside the cam slot.');
    if (!rotating(p) && +p.bladeWidth / 2 > (m.followerStart - 6) * Math.tan(Math.PI / 3) - 2)
      errors.push('Blades are too wide and would collide near the hub.');
    if (Math.hypot(m.servoLength - m.servoWidth / 2 + 6, m.servoWidth / 2) > m.radius - 1)
      errors.push('Servo mounting ears do not fit inside this tube.');
    return errors;
  },
  updateParameters(p, key) {
    if (key !== 'mechanism' && key !== 'servo') return p;
    if (jaynesHinged(p))
      return {
        ...p,
        servo: p.mechanism === 'jaynes-v1' ? 'micro' : p.servo,
        height: Math.max(
          +p.height,
          Math.ceil((+p.tubeOD / 2 - jaynesLayout(p).hinge + 12) / 0.32),
          120,
        ),
      };
    return { ...p, height: Math.max(+p.height, Math.ceil(layout(p).deck + (paired(p) ? 45 : 25))) };
  },
  buildGeometry: (p, s) => assembly.geometry(pieces(p, s)),
  dimensions: (p, s) => assembly.dimensions(pieces(p, s)),
  python: (p, s) => assembly.python(pieces(p, s)),
  notes:
    'Parametric adaptations of the linked mechanisms and supplied images, not original author CAD. Jaynes V1/V5 use reconstructed opposed geared flaps; V5 adds a second gear plane for a centered input. V2 uses rigid spatial crank links with solved closure. V3/V4 reuse the corresponding spiral/petal topology with the servo above the mechanism. Source tooth counts, dimensions, printed ball-bearing races and electronics are not reproduced. Waterloo uses linear Archimedean slots; the UGA/WPI-style sculpted cam uses an explicitly reconstructed smoothstep lift with tangential ends, not the article’s dimensional polynomial. Curved links use exact slider-crank closure, giving nonlinear radial travel. MIT uses two opposed pairs of straight links and resin sliding trays on two levels. Sprague uses two 20-tooth pinions and four involute-compatible racks. Geared petals pivot on fixed axes with an 18:42 gear ratio; their extension follows rotation, so radial-travel and blade-width controls are hidden. The tube windows, guides, drive shaft and hardware change with the mechanism. Threads, servo internals and bearing races are simplified; servo envelopes use Tower Pro nominal body sizes. Tube Ø80/76 and the remaining preset dimensions are custom adaptations. Aerodynamic loads, torque suitability, structural strength and flight performance are not established by this model.',
  sources: [
    {
      label: 'Ben Jaynes · 3D Printed Airbrakes for a Model Rocket · V1–V5',
      url: 'https://www.benjaynes.com/projects/airbrakes/',
    },
    {
      label: 'MIT Rocket Team · sliding leaves and trays',
      url: 'https://wikis.mit.edu/confluence/display/RocketTeam/Air+Brakes',
    },
    {
      label: 'Schnupp et al. 2025 · curved-link and sculpted-cam designs (Figures 1–2)',
      url: 'https://doi.org/10.2514/6.2025-98650',
    },
    {
      label: 'Sprague et al. 2024 · four-leaf rack and pinion (Figure 2)',
      url: 'https://doi.org/10.2514/6.2024-85628',
    },
    {
      label: 'Armaan Sengupta · Rocket AirBrakes mechanism',
      url: 'https://www.armaansengupta.ca/rocketry',
    },
    {
      label: 'Tower Pro · MG996R servo body reference',
      url: 'https://towerpro.com.tw/product/mg996r/',
    },
    {
      label: 'Tower Pro · MG90S servo body reference',
      url: 'https://towerpro.com.tw/product/mg90s-3/',
    },
    {
      label: 'NSK · miniature bearing dimensions (683ZZ)',
      url: 'https://www.nsk.com/content/dam/nsk/common/catalogs/ctrgPdf/bearings/e1103c_partc.pdf',
    },
  ],
};
export default withParameterStates(part, { mechanism: ['height'] });
