export type SwitchForm = 'toggle' | 'rocker' | 'rotary' | 'pushbutton' | 'tactile';
export interface SwitchModel {
  id: string;
  name: string;
  designation: string;
  manufacturer: string;
  form: SwitchForm;
  actuation: string;
  behavior: string;
  circuit: string;
  positions: number;
  terminalCount: number;
  termination: string;
  mounting: string;
  mountDiameter?: number;
  cutoutLength?: number;
  cutoutWidth?: number;
  guarded: boolean;
  poles: number;
  source: string;
  sourceName: string;
  evidence: string;
  limitations: string;
  body: [number, number, number];
  bushing?: number;
  bushingHeight?: number;
  leverLength?: number;
  height?: number;
  pitch?: [number, number];
  illuminated?: boolean;
}
export const daierColours = [
  { value: 'red', label: 'Red', color: 0xdc3e35, suffix: 'TR' },
  { value: 'green', label: 'Green', color: 0x43aa67, suffix: 'TG' },
  { value: 'yellow', label: 'Yellow', color: 0xe6b835, suffix: 'TY' },
  { value: 'blue', label: 'Blue', color: 0x408ed7, suffix: 'TBL' },
];
export const sourceUrls = {
  toggle: 'https://www.ckswitches.com/media/1394/7000toggle.pdf',
  rocker: 'https://www.e-switch.com/wp-content/uploads/2024/08/R1966.pdf',
  rockerDetail: 'https://configured-product-images.s3.amazonaws.com/2D/specs/R1966ABLKBLKFF.pdf',
  rotary: 'https://www.ckswitches.com/media/1349/arotary.pdf',
  pushbutton: 'https://www.e-switch.com/wp-content/uploads/2022/12/PVA6.pdf',
  tactile: 'https://omronfs.omron.com/en_US/ecb/products/pdf/en-b3f.pdf',
  apem: 'https://www.apem.com/en-us/panel-switches/toggles/12000/12146ak',
  apemGuard: 'https://www.apem.com/panel-switches/switch-guards/sg-90-series',
  daier: 'https://www.chinadaier.com/wp-content/uploads/2018/05/ASW-07D-1.pdf',
  daierGuard: 'https://www.chinadaier.com/wp-content/uploads/2018/05/SAC-01.pdf',
  daierPair:
    'https://www.daierswitches.com/products/racing-auto-20a-12v-lighted-toggle-switch-with-safety-guard',
};
const simpleLimits =
  'Installation reconstruction from published dimensions. Internal contacts, thread helices, edge radii, terminal hole details and moulded lettering are omitted. Undimensioned shell details and nut sizes are illustrative. Not original manufacturer CAD.';
const toggles: SwitchModel[] = [
  ['7101', 1, 'ON–ON', 'Maintained', 2],
  ['7103', 1, 'ON–OFF–ON', 'Maintained', 3],
  ['7105', 1, '(ON)–OFF–(ON)', 'Momentary both ends', 3],
  ['7108', 1, 'ON–(ON)', 'Momentary one end', 2],
  ['7201', 2, 'ON–ON', 'Maintained', 2],
  ['7203', 2, 'ON–OFF–ON', 'Maintained', 3],
  ['7205', 2, '(ON)–OFF–(ON)', 'Momentary both ends', 3],
  ['7207', 2, 'ON–OFF–(ON)', 'Momentary one end', 3],
].map<SwitchModel>(([code, poles, action, behavior, positions]) => ({
  id: 'ck-' + code + 'syzqe',
  name: `C&K ${code}SYZQE · ${poles === 1 ? 'SPDT' : 'DPDT'} · ${action}`,
  designation: `${code}SYZQE`,
  manufacturer: 'C&K / Littelfuse',
  form: 'toggle',
  actuation: 'Toggle',
  behavior: String(behavior),
  circuit: poles === 1 ? 'SPDT' : 'DPDT',
  positions: Number(positions),
  terminalCount: Number(poles) * 3,
  termination: 'Solder lug',
  mounting: 'Threaded bushing',
  mountDiameter: 6.35,
  guarded: false,
  poles: Number(poles),
  source: sourceUrls.toggle,
  sourceName: 'C&K 7000 series manufacturer drawing',
  evidence:
    'S actuator Ø2.92 × 10.67 mm; Y bushing 1/4-40 × 8.89 mm; 12.70 mm body length; SP 6.86 mm / DP 11.43 mm width; 8.89 mm body depth; 4.70 mm terminal pitch; 25° lever travel.',
  limitations:
    simpleLimits +
    ' The 6.35 mm characteristic is the nominal bushing interface; add the drawing tolerance and anti-rotation keyway for a production panel.',
  body: [12.7, poles === 1 ? 6.86 : 11.43, 8.89],
  bushing: 6.35,
  bushingHeight: 8.89,
  leverLength: 10.67,
}));
const rockers: SwitchModel[] = [
  ['R1966ABLKBLKFF', 'SPST', 'ON–OFF', 'Maintained', 2, 2],
  ['R1966FBLKBLKAF', 'SPST', 'OFF–(ON)', 'Momentary one end', 2, 2],
  ['R1966DBLKBLKAF', 'SPDT', 'ON–OFF–ON', 'Maintained', 3, 3],
].map<SwitchModel>(([code, circuit, action, behavior, positions, terminalCount]) => ({
  id: 'eswitch-' + String(code).toLowerCase(),
  name: `E-Switch ${code} · ${circuit} · ${action}`,
  designation: String(code),
  manufacturer: 'E-Switch',
  form: 'rocker',
  actuation: 'Rocker',
  behavior: String(behavior),
  circuit: String(circuit),
  positions: Number(positions),
  terminalCount: Number(terminalCount),
  termination: '4.8 mm quick-connect',
  mounting: 'Snap-in',
  cutoutLength: 19.2,
  cutoutWidth: 13,
  guarded: false,
  poles: 1,
  source: sourceUrls.rocker,
  sourceName: 'E-Switch R1966 series and configuration drawing',
  evidence:
    '20.80 × 14.80 mm bezel; 18.50 × 12.90 mm body cross-section; 19.2–19.3 × 13.0–13.1 mm panel opening for 0.75–1.25 mm panel; 4.80 × 0.80 mm quick-connect terminals.',
  limitations:
    simpleLimits +
    ' The catalogue stores the minimum opening for a thin panel. Required length grows to 19.5–19.6 mm for a 2–3 mm panel. Rocker concavity and clip flex are simplified; 14 mm body depth is read from the dimensional side view.',
  body: [18.5, 12.9, 14],
}));
const rotaries: SwitchModel[] = [3, 6, 12].map<SwitchModel>((positions) => ({
  id: `ck-a1${String(positions).padStart(2, '0')}03rnzq`,
  name: `C&K A1${String(positions).padStart(2, '0')}03RNZQ · 1 pole · ${positions} positions`,
  designation: `A1${String(positions).padStart(2, '0')}03RNZQ`,
  manufacturer: 'C&K / Littelfuse',
  form: 'rotary',
  actuation: 'Rotary selector',
  behavior: 'Maintained',
  circuit: `SP${positions}T`,
  positions,
  terminalCount: positions + 1,
  termination: 'Solder lug',
  mounting: 'Threaded bushing',
  mountDiameter: 9.8,
  guarded: false,
  poles: 1,
  source: sourceUrls.rotary,
  sourceName: 'C&K A series manufacturer drawing',
  evidence:
    'Ø26.19 mm body; 12.83 mm case depth; 3/8-32 bushing 6.99 mm high; Ø6.35 mm shaft with 5.51 mm flat; 03 shaft 9.53 mm high; Ø9.80 mm panel hole plus Ø3.18 mm anti-rotation feature; 30° indexing.',
  limitations:
    simpleLimits +
    ' The model includes the shaft D-flat and the selected solder-lug count. Anti-rotation pin, pin orientation and internal detent mechanism are omitted; use the manufacturer drawing for the complete panel pattern. No knob is included.',
  body: [26.19, 26.19, 12.83],
  bushing: 9.525,
  bushingHeight: 6.99,
  leverLength: 9.53,
}));
const pushbuttons: SwitchModel[] = [
  ['PVA6FE24S41', 'Momentary one end', 'OFF–(ON)', 13.8, 1.5],
  ['PVA6LRE21231', 'Latching', 'OFF–ON', 19.6, 2.2],
].map<SwitchModel>(([code, behavior, action, depth, height]) => ({
  id: 'eswitch-' + String(code).toLowerCase(),
  name: `E-Switch ${code} · Ø16 mm · ${action}`,
  designation: String(code),
  manufacturer: 'E-Switch',
  form: 'pushbutton',
  actuation: 'Pushbutton',
  behavior: String(behavior),
  circuit: 'SPST-NO',
  positions: 2,
  terminalCount: 4,
  termination: 'Solder lug',
  mounting: 'Threaded bushing',
  mountDiameter: 16,
  guarded: false,
  poles: 1,
  source: `https://configured-product-images.s3.amazonaws.com/2D/specs/${code}.pdf`,
  sourceName: 'E-Switch fixed-configuration manufacturer drawing',
  evidence: `Ø18.50 mm bezel; M16 × 1 threaded body; Ø16.0–16.2 mm panel hole with 15.4–15.6 mm orientation flat; ${depth} mm rear body depth plus ${behavior === 'Latching' ? 4.5 : 4} mm terminals; ${height} mm front projection; separate switch and LED terminal pairs.${behavior === 'Latching' ? ' Body orientation flats are 15.3 mm across in the fixed drawing.' : ''}`,
  limitations:
    simpleLimits +
    ' The ring represents the specified blue / green LED colour; illumination and electrical state are not simulated. Rounded bezel profile is simplified. Panel hole orientation flat is a drawing requirement, not a circular drilling template.' +
    (behavior === 'Latching'
      ? ''
      : ' The momentary body flats are not dimensioned in its drawing: 15.3 mm across is an illustrative 0.1 mm clearance choice inside the published 15.4 mm panel flat, not a verified article measurement.'),
  body: [16, 16, Number(depth)],
  height: Number(height),
  bushing: 16,
}));
const tactiles: SwitchModel[] = [
  ['B3F-1000', 6, 4.3, 3.5, 6.5, 4.5],
  ['B3F-1020', 6, 5, 3.5, 6.5, 4.5],
  ['B3F-1050', 6, 7.3, 3, 6.5, 4.5],
  ['B3F-4000', 12, 4.3, 7.1, 12.5, 5],
].map<SwitchModel>(([code, side, height, plunger, pitchX, pitchY]) => ({
  id: 'omron-' + String(code).toLowerCase(),
  name: `Omron ${code} · ${side} × ${side} mm · H${height} mm`,
  designation: String(code),
  manufacturer: 'Omron',
  form: 'tactile',
  actuation: 'Tactile button',
  behavior: 'Momentary one end',
  circuit: 'SPST-NO',
  positions: 2,
  terminalCount: 4,
  termination: 'Through-hole PCB',
  mounting: 'PCB through-hole',
  guarded: false,
  poles: 1,
  source: sourceUrls.tactile,
  sourceName: 'Omron B3F manufacturer drawing',
  evidence: `${side} × ${side} mm body; ${height} mm actuator height above PCB; ${pitchX} × ${pitchY} mm terminal centre pattern; Ø${plunger} mm actuator. Four terminals form two permanently common pairs.`,
  limitations:
    simpleLimits +
    ' Bent leads are simplified to connected L sections at the published board centres. Metal lid folds and spring dome are omitted. Push travel is a 0.2 mm inspection displacement within published pretravel, not a force model.',
  body: [Number(side), Number(side), 3.4],
  height: Number(height),
  leverLength: Number(plunger),
  pitch: [Number(pitchX), Number(pitchY)],
}));
const apem: SwitchModel = {
  id: 'apem-12146ak',
  name: 'APEM 12146AK · DPDT · ON–ON',
  designation: '12146AK',
  manufacturer: 'APEM',
  form: 'toggle',
  actuation: 'Toggle',
  behavior: 'Maintained',
  circuit: 'DPDT',
  positions: 2,
  terminalCount: 6,
  termination: 'Solder lug',
  mounting: 'Threaded bushing',
  mountDiameter: 12,
  guarded: false,
  poles: 2,
  source: sourceUrls.apem,
  sourceName: 'APEM 12000 series product and mechanical drawing',
  evidence:
    '12146AK DPDT maintained solder-lug execution; 15/32-32 threaded bushing, Ø12 mm panel opening; standard lever. Manufacturer 12000 series / 90-series compatibility uses the Ø11.9/12 mm bushing class.',
  limitations:
    'Body envelope 18.2 × 14 × 13.7 mm, 10.9 mm bushing height and 17.3 mm lever are reconstruction values awaiting the exact supplier drawing revision. Terminal positions, nut profile and keyway geometry are illustrative. No rating is inferred. Not original manufacturer CAD.',
  body: [18.2, 14, 13.7],
  bushing: 11.906,
  bushingHeight: 10.9,
  leverLength: 17.3,
};
const daier: SwitchModel = {
  id: 'daier-asw-07d',
  name: 'DAIER ASW-07D · illuminated SPST · ON–OFF',
  designation: 'ASW-07D',
  manufacturer: 'DAIER',
  form: 'toggle',
  actuation: 'Toggle',
  behavior: 'Maintained',
  circuit: 'SPST',
  positions: 2,
  terminalCount: 3,
  termination: '6.3 × 0.8 mm quick-connect',
  mounting: 'Threaded bushing',
  mountDiameter: 12.2,
  guarded: false,
  illuminated: true,
  poles: 1,
  source: sourceUrls.daier,
  sourceName: 'DAIER ASW-07D manufacturer dimensional drawing',
  evidence:
    'Drawing ASW-07D-1: 28 × 16 × 19 mm case; M12 × 0.75 bushing, 12.5 mm projection; Ø7 mm actuator, 19.9 mm projection and 24° total travel; 24.2 mm lower terminal spacing, 10.3 mm terminal projection and 6.3 mm blade width; Ø12.2 mm panel opening with 1.9 × 0.9 mm orientation tongue. Three terminals provide switched supply, load and lamp ground. Red, green, yellow and blue LED options are manufacturer-listed.',
  limitations:
    'Installation reconstruction from the linked ASW-07D-1 drawing. Not original manufacturer CAD. The public product page also quotes 28.3 × 16 × 56 mm, corresponding to a different drawing execution; this model follows the linked 28 × 16 × 19 mm case drawing. Current ratings conflict between the drawing and product/store tables, so none is assigned. Nut and washer profiles, terminal holes, horizontal ground-blade length, actuator end-lens profile and bushing groove depth are illustrative. Blade thickness 0.8 mm follows the manufacturer paired-product specification. Thread helices, lettering and internal contacts are omitted. LED colour is an ordering option, not an electrical simulation.',
  body: [28, 16, 19],
  bushing: 12,
  bushingHeight: 12.5,
  leverLength: 19.9,
};
export const models: SwitchModel[] = [
  ...toggles,
  ...rockers,
  ...rotaries,
  ...pushbuttons,
  ...tactiles,
  apem,
  {
    ...apem,
    id: 'apem-12146ak-90c46',
    designation: '12146AK + 90C46',
    name: 'APEM 12146AK + 90C46 · DPDT · red protective cover',
    guarded: true,
    actuation: 'Guarded toggle',
    source: sourceUrls.apemGuard,
    sourceName: 'APEM 90-series guard and 12000-series compatibility',
    evidence:
      apem.evidence +
      ' 90C46 is red, keyway-left and locks the toggle in its down position. Guard is a separately ordered accessory.',
    limitations:
      apem.limitations +
      ' Guard roof, side walls, base, hinge, open angle and adjustment are fixed photo-derived approximations. Guard sweep is useful for layout only and must be measured on the purchased assembly. Closed pose holds the first switch position; no miniature 6.35 mm switch is paired with this 12 mm guard.',
  },
  daier,
  {
    ...daier,
    id: 'daier-asw-07d-sac-01',
    name: 'DAIER ASW-07D + SAC-01 · illuminated SPST · transparent protective cover',
    designation: 'ASW-07D + SAC-01',
    guarded: true,
    actuation: 'Guarded toggle',
    source: sourceUrls.daierPair,
    sourceName: 'DAIER paired ASW-07D + SAC-01 product and manufacturer drawings',
    evidence:
      daier.evidence +
      ' SAC-01 drawing: 46.6 mm closed assembly length, 27.8 mm height above the base seat; 40.6 mm base length, 17 / 15 mm base widths and 0.9 mm sheet thickness; Ø12 mm keyed mounting hole; hinge axis 11.8 mm from the base rear end; 45 mm open height. Manufacturer paired colour codes are ASW-07D+SAC-01-TR / -TG / -TY / -TBL. Closing the hinged cover returns the toggle to OFF.',
    limitations:
      daier.limitations +
      " SAC-01 cap width 20 mm follows the manufacturer product envelope; the drawing only dimensions the base widths. The rounded shell profile follows the drawing silhouette, while wall thickness, hole-to-hinge distance, hinge bore/pin, spring and 69° inspection opening angle are illustrative. A 9.5 mm base-seat height and retaining-nut stack are an illustrative installation adjustment chosen to clear the selected actuator. The open pose approximates the drawing's 45 mm envelope within 0.05 mm, not a verified angular stop. Transparent coloured plastic is shown with illustrative 55% opacity in the preview; native export retains RGB colour. Confirm the purchased revision and adjustment before machining a panel or relying on the interlock.",
  },
];
export function selected(value: unknown): SwitchModel {
  const model = models.find((model) => model.id === value);
  if (!model) throw new Error('Choose a supported switch model.');
  return model;
}
