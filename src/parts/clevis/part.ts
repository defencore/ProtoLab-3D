import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { n, num } from '../../core/geometry';
import { defaults, parameters } from './configurator';
import presetData from './presets.json';
import {
  box,
  component,
  cylinder,
  intersect,
  pythonHelpers,
  pythonShape,
  subtract,
  thread,
  union,
} from './lib/shapes';
import type { Shape, Vec } from './lib/shapes';

export const isThreaded = (p: Parameters) =>
  p.variant === 'female-threaded' || p.variant === 'male-threaded';
export function values(p: Parameters) {
  const L = n(p, 'length'),
    R = n(p, 'bodyDiameter') / 2,
    pin = n(p, 'pinDiameter'),
    c = n(p, 'clearance');
  return {
    L,
    R,
    pin,
    c,
    pinZ: L - n(p, 'pinOffset'),
    base: L - n(p, 'forkDepth'),
    screwZ: Array.from(
      { length: n(p, 'setScrewCount') },
      (_, i) => n(p, 'setScrewOffset') + i * n(p, 'setScrewSpacing'),
    ),
  };
}
function bodyShape(p: Parameters): Shape {
  const v = values(p);
  const roundTip = union(
    box([2 * v.R + 2, 2 * v.R + 2, v.L - v.R], [-v.R - 1, -v.R - 1, 0]),
    cylinder(v.R, 2 * v.R + 2, [0, -v.R - 1, v.L - v.R], 'y'),
  );
  const cuts: Shape[] = [
    box(
      [2 * v.R + 2, n(p, 'forkGap'), n(p, 'forkDepth') + 1],
      [-v.R - 1, -n(p, 'forkGap') / 2, v.base],
    ),
    cylinder(v.pin / 2 + v.c, 2 * v.R + 2, [0, -v.R - 1, v.pinZ], 'y'),
  ];
  if (p.variant !== 'male-threaded') {
    const depth = n(p, 'rodDepth');
    cuts.push(
      p.variant === 'female-threaded' && p.threadMode === 'modeled'
        ? thread(
            n(p, 'rodDiameter') / 2,
            depth + 0.1,
            [0, 0, -0.1],
            n(p, 'threadPitch'),
            p.handedness === 'left' ? -1 : 1,
            true,
          )
        : cylinder(n(p, 'rodDiameter') / 2, depth + 0.1, [0, 0, -0.1]),
    );
  }
  if (!isThreaded(p))
    for (const z of v.screwZ)
      cuts.push(cylinder(n(p, 'setScrewDiameter') / 2 + v.c, v.R + 0.5, [0, 0, z], 'y'));
  let body: Shape = subtract(intersect(cylinder(v.R, v.L, [0, 0, 0]), roundTip), ...cuts);
  if (p.variant === 'male-threaded') {
    const h = n(p, 'maleLength');
    const shank =
      p.threadMode === 'modeled'
        ? thread(
            n(p, 'rodDiameter') / 2,
            h + 0.1,
            [0, 0, -h],
            n(p, 'threadPitch'),
            p.handedness === 'left' ? -1 : 1,
            false,
          )
        : cylinder(n(p, 'rodDiameter') / 2, h + 0.1, [0, 0, -h]);
    body = union(body, shank);
  }
  return body;
}
type Component = { shape: Shape; label: string; color: number; shift: Vec };
const finishes: Record<string, number> = {
  red: 0xba4750,
  blue: 0x318fb9,
  steel: 0xa2aab3,
  black: 0x303841,
};
export function assembly(p: Parameters, state: string): Component[] {
  const v = values(p),
    explode = state === 'exploded' ? 2 * v.R : 0;
  const result: Component[] = [
    {
      shape: bodyShape(p),
      label: 'Clevis body',
      color: finishes[String(p.finish)],
      shift: [0, 0, 0],
    },
  ];
  if (state === 'body' || !p.includeHardware) return result;
  const headR = v.pin * 0.85,
    headH = v.pin * 0.65,
    pinStart = -v.R - v.pin * 1.05,
    pinEnd = v.R + v.c;
  const pin = subtract(
    union(
      cylinder(v.pin / 2, pinEnd - pinStart, [0, pinStart, v.pinZ], 'y'),
      cylinder(headR, headH, [0, pinEnd, v.pinZ], 'y'),
    ),
    cylinder(v.pin * 0.3, headH * 0.6 + 0.1, [0, pinEnd + headH * 0.4, v.pinZ], 'y', 6),
  );
  result.push({ shape: pin, label: 'Clevis pin screw', color: 0xaeb7c1, shift: [0, explode, 0] });
  const nutH = v.pin * 0.7,
    nutY = -v.R - v.c - nutH;
  const nut = subtract(
    cylinder(v.pin, nutH, [0, nutY, v.pinZ], 'y', 6),
    cylinder(v.pin / 2 + v.c, nutH + 0.2, [0, nutY - 0.1, v.pinZ], 'y'),
  );
  result.push({ shape: nut, label: 'Pin locknut', color: 0xaeb7c1, shift: [0, -explode, 0] });
  if (!isThreaded(p)) {
    const d = n(p, 'setScrewDiameter'),
      bottom = n(p, 'rodDiameter') / 2 + v.c,
      top = v.R;
    for (const [i, z] of v.screwZ.entries()) {
      const screw = subtract(
        cylinder(d / 2, top - bottom, [0, bottom, z], 'y'),
        cylinder(
          d * 0.28,
          (top - bottom) * 0.5 + 0.1,
          [0, bottom + (top - bottom) * 0.5, z],
          'y',
          6,
        ),
      );
      result.push({
        shape: screw,
        label: `Rod set screw ${i + 1}`,
        color: 0x313740,
        shift: [0, explode, 0],
      });
    }
  }
  return result;
}
function bounds(p: Parameters, state: string): [number, number, number] {
  const v = values(p),
    male = p.variant === 'male-threaded' ? n(p, 'maleLength') : 0;
  if (state === 'body' || !p.includeHardware) return [v.R * 2, v.R * 2, v.L + male];
  const extra = state === 'exploded' ? v.R * 2 : 0;
  const lowY = Math.min(-v.R, -v.R - v.pin * 1.05 + extra, -v.R - v.c - v.pin * 0.7 - extra);
  const highY = v.R + v.c + v.pin * 0.65 + extra;
  const maxX = Math.max(v.R, v.pin);
  const maxZ = Math.max(v.L, v.pinZ + v.pin * Math.sin(Math.PI / 3));
  const minZ = Math.min(-male, 0, v.pinZ - v.pin * Math.sin(Math.PI / 3));
  return [maxX * 2, highY - lowY, maxZ - minZ];
}
const part: PartDefinition = {
  id: 'clevis',
  name: 'Clevis / fork end',
  category: 'MOTION',
  subgroup: 'SERVO LINKAGES',
  icon: 'bracket',
  description:
    'Pushrod clamps, threaded fork ends and cable terminals with an open fork, transverse pin and removable fasteners.',
  complexity: 'Fork + removable hardware',
  keywords: [
    'clevis',
    'fork',
    'servo',
    'pushrod',
    'linkage',
    'cable terminal',
    'rod end',
    'jaw terminal',
    'female thread',
    'male thread',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['variant', 'rodDiameter', 'pinDiameter', 'forkGap'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Fork body, pin screw, locknut and clamping screws in their working positions.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description:
        'Pin screw, locknut and set screws move away from the fork as separate components.',
    },
    {
      id: 'body',
      label: 'Fork body only',
      description: 'Open fork and rod connection without removable hardware.',
    },
  ],
  validate(p) {
    const v = values(p),
      errors: string[] = [],
      rod = n(p, 'rodDiameter'),
      gap = n(p, 'forkGap'),
      pinR = v.pin / 2 + v.c;
    if (gap >= 2 * v.R - 0.8)
      errors.push('Fork gap must leave at least 0.4 mm on each fork cheek.');
    if (v.L <= v.R + 1 || v.base < 2)
      errors.push('Body length must leave a rear barrel and a rounded fork tip.');
    if (n(p, 'forkDepth') <= 2 * pinR + 0.5)
      errors.push('Fork opening is too short for the pin hole.');
    if (n(p, 'pinOffset') <= pinR + 0.3 || v.pinZ - v.base <= pinR + 0.3)
      errors.push('Pin hole must remain inside the open fork with material at both ends.');
    if (pinR >= Math.sqrt(v.R * v.R - (gap * gap) / 4) - 0.25)
      errors.push('Pin hole is too large for the remaining fork cheek width.');
    if (rod >= 2 * v.R - 0.8) errors.push('Rod diameter must leave a continuous barrel wall.');
    if (p.variant !== 'male-threaded' && n(p, 'rodDepth') > v.base + 0.01)
      errors.push('Rod bore must end at or before the start of the fork opening.');
    if (!isThreaded(p)) {
      const d = n(p, 'setScrewDiameter');
      if (!Number.isInteger(n(p, 'setScrewCount')))
        errors.push('Set screw count must be a whole number.');
      if (d + 2 * v.c >= 2 * v.R - 0.5) errors.push('Set screw holes are too wide for the barrel.');
      if (rod / 2 + v.c >= v.R - 0.4)
        errors.push('Set screws need a positive length between the rod and outside surface.');
      if (
        v.screwZ.some(
          (z) =>
            z - d / 2 - v.c <= 0.3 || z + d / 2 + v.c >= Math.min(v.base, n(p, 'rodDepth')) - 0.2,
        )
      )
        errors.push('Set screw holes must lie within the rear barrel and reach the rod bore.');
      if (n(p, 'setScrewCount') > 1 && n(p, 'setScrewSpacing') <= d + 2 * v.c + 0.3)
        errors.push('Set screw holes need separate walls between adjacent positions.');
    }
    if (isThreaded(p) && p.threadMode === 'modeled') {
      const pitch = n(p, 'threadPitch'),
        h = n(p, p.variant === 'male-threaded' ? 'maleLength' : 'rodDepth');
      if (rod / 2 - 0.62 * pitch < 0.3)
        errors.push('Thread pitch must leave a positive thread core.');
      if (h / pitch > 70)
        errors.push(
          'Modeled rod threads are limited to 70 turns; increase pitch or choose the smooth envelope.',
        );
    }
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group();
    for (const c of assembly(p, state)) {
      const object = component(c.shape, c.label, c.color);
      object.position.x += c.shift[0];
      object.position.y += c.shift[1];
      object.position.z += c.shift[2];
      group.add(object);
    }
    return group;
  },
  python(p, state) {
    const lines = [
      '# Clevis assembly. All removable hardware is exported as independent components.',
      '# Hardware threads use smooth envelopes. Only the optional rod thread is helical.',
      pythonHelpers,
      'components = []',
      'component_labels = []',
      'component_colors = []',
    ];
    for (const c of assembly(p, state)) {
      lines.push(`item = ${pythonShape(c.shape)}.removeSplitter()`);
      if (c.shift.some((v) => v !== 0))
        lines.push(`item.translate(App.Vector(${c.shift.map(num).join(',')}))`);
      lines.push(
        'if item.isNull() or not item.isValid() or len(item.Solids) != 1: raise ValueError("A clevis component failed solid validation.")',
        'components.append(item)',
        `component_labels.append(${JSON.stringify(c.label)})`,
        `component_colors.append((${[(c.color >> 16) & 255, (c.color >> 8) & 255, c.color & 255].map((v) => num(v / 255)).join(',')}))`,
      );
    }
    lines.push('shape = Part.makeCompound(components)');
    return lines.join('\n');
  },
  dimensions: bounds,
  updateParameters(p, key) {
    if (key === 'variant') {
      if (p.variant === 'female-threaded')
        return {
          ...p,
          bodyDiameter: 8,
          length: 25,
          forkGap: 3,
          forkDepth: 11,
          pinDiameter: 3,
          pinOffset: 4,
          rodDiameter: 3,
          rodDepth: 8,
          threadPitch: 0.5,
          finish: 'steel',
        };
      if (p.variant === 'male-threaded')
        return {
          ...p,
          bodyDiameter: 8,
          length: 25,
          forkGap: 3,
          forkDepth: 11,
          pinDiameter: 3,
          pinOffset: 4,
          rodDiameter: 4,
          maleLength: 12,
          threadPitch: 0.7,
          finish: 'steel',
        };
      return {
        ...p,
        ...defaults,
        variant: p.variant,
        finish: p.variant === 'cable' ? 'steel' : 'red',
      };
    }
    return p;
  },
  notes:
    'The 25 × 7 mm pushrod reference verifies its 3 mm fork gap, 2 mm rod bore, M2.5 pin screw and M3 set screws. Fork depth, pin setback, clearances and hardware sizes are editable prototype assumptions. Cable presets verify only the listed cable diameter. Threaded variants are prototype examples, not a named standard. Modeled rod threads use an untoleranced basic 60-degree profile; pin, nut and set-screw threads remain smooth envelopes. The cable terminal is a simplified fixed fork with a set-screw barrel; no swivel, swage qualification or rated load is modeled.',
  sources: [
    {
      label: 'Supplied pushrod clevis dimensions',
      url: 'references/clevis-pushrod-dimensions.png',
    },
    { label: 'Supplied assembled servo linkage', url: 'references/clevis-servo-linkage.png' },
    {
      label: 'Supplied fork and removable hardware',
      url: 'references/clevis-pushrod-assembly.png',
    },
    {
      label: 'Supplied cable terminal and bore choices',
      url: 'references/clevis-cable-terminal.png',
    },
  ],
};
export default part;
