import type { Parameters } from '../../../core/types';
/** Preliminary linear spring/energy model. G=79 GPa is an assumed spring-steel modulus. */
export function springAssessment(p: Parameters) {
  const wire = +p.springWire,
    travel = +p.springTravel,
    preload = +p.springPreload;
  const rate = (79000 * wire ** 4) / (8 * 5 ** 3 * 6);
  const startForce = 4 * rate * (travel + preload),
    endForce = 4 * rate * preload;
  const energy = (4 * rate * ((travel + preload) ** 2 - preload ** 2)) / 2000;
  const resistance = +p.extractionForce + +p.noseMass * 9.80665;
  const work = (resistance * +p.extractionDistance) / 1000;
  const required = (work + (+p.noseMass * (+p.exitSpeed) ** 2) / 2) * 1.5;
  const index = 5 / wire,
    wahl = (4 * index - 1) / (4 * index - 4) + 0.615 / index;
  return {
    rate,
    startForce,
    endForce,
    energy,
    required,
    resistance,
    freeLength: 9.2 + travel + preload,
    stress: (wahl * 8 * (startForce / 4) * 5) / (Math.PI * wire ** 3),
    speed: Math.sqrt(Math.max(0, (2 * (energy - work)) / +p.noseMass)),
    sufficient: startForce > resistance && energy >= required,
  };
}
export function springReport(p: Parameters): string[] {
  if (!['st3215-nose', 'wing-mini-nose'].includes(String(p.drive))) return [];
  const s = springAssessment(p);
  return [
    'Preliminary spring sizing — mass and extraction load are editable assumptions. No spring supplier or strength rating is selected.',
    `4 springs: estimated k=${s.rate.toFixed(2)} N/mm each; total force ${s.startForce.toFixed(1)} → ${s.endForce.toFixed(1)} N over ${p.springTravel} mm.`,
    `Available work ${s.energy.toFixed(3)} J; required ${s.required.toFixed(3)} J including 1.5× energy allowance over ${p.extractionDistance} mm. ${s.sufficient ? 'Passes the assumed energy budget.' : 'Insufficient for the entered load/energy budget.'}`,
    `Ideal exit speed ${s.speed.toFixed(2)} m/s. Estimated maximum wire shear stress ${s.stress.toFixed(0)} MPa; verify against the selected spring material and supplier load rating.`,
    `Axial tube seam ${p.tubeSeam} mm; radial installation clearance ${p.fitClearance} mm. Gear axial clearance 0.15 mm per side. Tolerances, ovality and coatings must fit within these nominal clearances.`,
  ];
}
