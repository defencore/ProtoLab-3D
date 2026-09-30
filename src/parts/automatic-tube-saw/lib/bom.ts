// Budget allocations in USD, not live supplier quotations. Fabrication, delivery and
// local taxes must be quoted before comparing the actual total with the $4000 cap.
export const budget = [
  {
    item: 'Contact encoder, optical pairs, inductive sensors and brackets',
    qty: 1,
    allowance: 700,
  },
  {
    item: 'Four EC5000 drives, controllers, take-away, long receiver and traction nip',
    qty: 1,
    allowance: 1540,
    module: 'feed',
  },
  { item: 'Welded S235 frame, machined mounting lands and table', qty: 1, allowance: 480 },
  { item: 'Freud LU5H50001 purchased blade', qty: 1, allowance: 220 },
  { item: 'BEVI 121116 spindle motor and ATV12HU22M2 drive', qty: 1, allowance: 650 },
  { item: 'Machined spindle, matched bearings, pulleys, belt and guard', qty: 1, allowance: 360 },
  {
    item: 'Feed screw, guides, supports, motor, driver and coupling',
    qty: 1,
    allowance: 380,
    module: 'feed',
  },
  {
    item: 'Admission gate, actuator, two loading drives/controllers and module guards',
    qty: 1,
    allowance: 930,
    module: 'automatic',
  },
  { item: 'DDCS v4.1 and isolated handshake interfaces', qty: 1, allowance: 360 },
  { item: 'Saw lift axis, load holding and regulated feed', qty: 1, allowance: 260 },
  {
    item: 'Four ACE50X25SG cutting clamps, guided tooling, valves and regulators',
    qty: 1,
    allowance: 700,
  },
  {
    item: 'Feed/traction clamps, two ACE50X200SG tray cylinders, two ACE50X100SG reject cylinders and valves',
    qty: 1,
    allowance: 700,
    module: 'feed',
  },
  {
    item: 'Independent infeed/outfeed frames, long chute and two bins',
    qty: 1,
    allowance: 750,
    module: 'feed',
  },
  { item: 'PLC, I/O expansion, operator controls, PSU and cabinet', qty: 1, allowance: 650 },
  {
    item: 'Guard locking, standstill sensing, E-stop, safety relay and contactors',
    qty: 1,
    allowance: 620,
  },
  { item: 'MQL, extraction interface, cables and miscellaneous fasteners', qty: 1, allowance: 220 },
];
export const budgetFor = (mode: string) =>
  budget
    .filter(
      (b) =>
        !b.module ||
        (b.module === 'feed' && mode !== 'manual') ||
        (b.module === 'automatic' && mode === 'automatic'),
    )
    .reduce((sum, b) => sum + b.qty * b.allowance, 0);
export const budgetTotal = budget.reduce((s, b) => s + b.qty * b.allowance, 0);
export const releaseBlockers = [
  'Validate DDCS/PLC handshake, full-length single-bar loading guard and stock-identity recovery; validate the modeled remnant purge, scrap selector and receiver before unattended use.',
  'Qualify the small-nose belt, narrow rolling shoe and short-part handover using actual swarf and coolant; check no-traction and jam faults.',
  'Confirm SFU1605 lift bearing interfaces, 2:1 drive, rated power-off brake and measured lift load before ordering.',
  'Confirm exact valve, air preparation, guard lock, standstill monitor, contactors, I/O expansion and operator-panel models; allocation models are not purchase approvals.',
  'Finish spindle bearing preload, blade clamping, shaft fatigue, balance, belt selection and guard containment calculations.',
  'Measure clamp slip, tube ovalisation, cutting forces and length error on D120x4, including 20 mm offcuts.',
  'Extend sampled CAD clearance checks to supplier-specific hardware, as-built tolerances and supplier-specific complete swept envelopes.',
  'Complete electrical/pneumatic schematics, fault recovery and safety validation before automatic operation.',
  'Obtain supplier and fabrication quotations. The current allocation exceeds $4000 before delivery, taxes and contingency.',
];
