import type { PartDefinition, Preset } from '../../core/types';
import { n } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import { dimensions, geometry, layout, python } from './lib/model';
import presetData from './presets.json';

const part: PartDefinition = {
  id: 'tubular-solenoid',
  name: 'Tubular solenoid',
  category: 'MOTORS & ACTUATORS',
  subgroup: 'SOLENOIDS',
  description:
    'Parametric tubular linear solenoid with pull or push output, guided armature, coil envelope and insulated terminals.',
  keywords: [
    'solenoid',
    'electromagnet',
    'linear actuator',
    'pull',
    'push',
    'coil',
    'plunger',
  ],
  icon: 'magnet',
  complexity: 'Moving assembly',
  parameters,
  defaults,
  presets: presetData as Preset[],
  presetMatchKeys: ['action', 'outerDiameter', 'bodyLength', 'plungerDiameter', 'stroke'],
  states: [
    {
      id: 'retracted',
      label: 'Retracted',
      description: 'Output rod at its minimum protrusion; housing stays at the origin.',
    },
    {
      id: 'extended',
      label: 'Extended',
      description: 'Output rod protrudes by one additional stroke. Only the armature and rod move.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Retracted components separated sideways to reveal the coil, guide and armature.',
    },
  ],
  validate(p, state) {
    const errors: string[] = [];
    for (const field of parameters) {
      const value = p[field.key];
      if (field.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value))
          errors.push(`${field.label} must be a finite number.`);
        else if (
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max)
        )
          errors.push(`${field.label} is outside its allowed range.`);
      } else if (field.type === 'boolean' && typeof value !== 'boolean')
        errors.push(`${field.label} must be enabled or disabled.`);
      else if (field.type === 'select' && !field.options?.some((option) => option.value === value))
        errors.push(`${field.label} has an unsupported value.`);
    }
    if (!['retracted', 'extended', 'exploded'].includes(state))
      errors.push('Select a supported solenoid state.');
    if (errors.length) return errors;
    const a = layout(p, state);
    if (a.inner <= 0) errors.push('Housing wall must leave a positive internal diameter.');
    if (a.coilOuter - a.coilInner < 0.5)
      errors.push('Allow at least 0.5 mm radial thickness for the coil outside the guide sleeve.');
    if (n(p, 'bodyLength') - 2 * a.end <= 2 * a.clearance + n(p, 'stroke') + n(p, 'plungerLength'))
      errors.push(
        'Body length must contain both end plates, armature length, full stroke and axial clearances.',
      );
    if (a.rod + a.clearance >= a.armature)
      errors.push('Output rod and its running clearance must be smaller than the armature.');
    if (n(p, 'plungerLength') < n(p, 'plungerDiameter'))
      errors.push('Armature length must be at least its diameter to retain guide engagement.');
    if (p.terminals) {
      const center = n(p, 'terminalSpacing') / 2;
      if (center - a.insulatorRadius <= a.coilInner || center + a.insulatorRadius >= a.coilOuter)
        errors.push(
          'Terminal insulators must fit completely within the coil annulus. Adjust terminal spacing, terminal diameter or body diameter.',
        );
    }
    return errors;
  },
  buildGeometry: geometry,
  python,
  dimensions,
  notes:
    'Prototype geometry, not a supplier specification. The coil is a solid winding envelope; individual turns, electrical ratings, force, insulation performance and a return spring are not modeled. Both actions attract the armature toward the rear pole: pull retracts the front rod, push extends the rear rod. Retracted and extended describe output protrusion. The housing remains centered on the Z axis; dimensions include rods and terminals. Export creates a separate solid for each physical component.',
};

export default part;
