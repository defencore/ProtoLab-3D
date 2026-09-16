import { withParameterStates } from '../../core/parameter-states';
import { Group } from 'three';
import { n, num } from '../../core/geometry';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { defaults, parameters } from './configurator';
import presetData from './presets.json';
import {
  bounds,
  box,
  component,
  cylinder,
  intersect,
  prism,
  pythonHelpers,
  pythonShape,
  subtract,
  union,
} from './lib/shapes';
import type { Bounds, Shape, Vec } from './lib/shapes';

export function rodValues(p: Parameters) {
  const c = n(p, 'fitClearance'),
    C = n(p, 'centerDistance');
  const smallHousing =
    n(p, 'smallBore') + (p.smallBushing ? 2 * (n(p, 'bushingThickness') + c) : 0);
  const bigHousing =
    n(p, 'bigBore') + (p.bigBearing === 'shells' ? 2 * (n(p, 'shellThickness') + c) : 0);
  const smallR = smallHousing / 2 + n(p, 'smallWall'),
    bigR = bigHousing / 2 + n(p, 'bigWall');
  return {
    c,
    C,
    smallHousing,
    bigHousing,
    smallR,
    bigR,
    smallW: n(p, 'smallWidth'),
    bigW: n(p, 'bigWidth'),
    beamT: n(p, 'shankThickness'),
    beamStart: bigR * 0.6,
    beamEnd: C - smallR * 0.6,
    pocketStart: bigR + 2,
    pocketEnd: C - smallR - 2,
    bolt: n(p, 'boltDiameter'),
    boltX: n(p, 'boltSpacing') / 2,
    grip: n(p, 'boltGrip'),
    lugWidth: n(p, 'boltDiameter') * 1.8,
  };
}
function half(p: Parameters, shape: Shape, upper: boolean, gap: number): Shape {
  const v = rodValues(p),
    extent = Math.max(v.bigR * 3, v.boltX * 2, v.C + v.smallR + 2),
    width = Math.max(v.bigW, v.smallW, v.beamT) + 4;
  return intersect(
    shape,
    box([2 * extent, width, extent], [-extent, -width / 2, upper ? gap / 2 : -extent - gap / 2]),
  );
}
function completeRod(p: Parameters): Shape {
  const v = rodValues(p),
    wide = Math.max(v.bigW, v.smallW, v.beamT) + 2;
  const shank = prism(
    [
      [-n(p, 'shankWidth') / 2, v.beamStart],
      [n(p, 'shankWidth') / 2, v.beamStart],
      [n(p, 'smallShankWidth') / 2, v.beamEnd],
      [-n(p, 'smallShankWidth') / 2, v.beamEnd],
    ],
    v.beamT,
    -v.beamT / 2,
  );
  const pieces: Shape[] = [
    cylinder(v.bigR, v.bigW, [0, -v.bigW / 2, 0]),
    cylinder(v.smallR, v.smallW, [0, -v.smallW / 2, v.C]),
    shank,
  ];
  if (p.bigEnd === 'split-cap')
    for (const sign of [-1, 1])
      pieces.push(
        box(
          [v.lugWidth, v.bigW, v.grip],
          [sign * v.boltX - v.lugWidth / 2, -v.bigW / 2, -v.grip / 2],
        ),
      );
  const cuts: Shape[] = [
    cylinder(v.bigHousing / 2, wide, [0, -wide / 2, 0]),
    cylinder(v.smallHousing / 2, wide, [0, -wide / 2, v.C]),
  ];
  if (p.bigEnd === 'split-cap')
    for (const sign of [-1, 1]) {
      cuts.push(cylinder(v.bolt / 2 + v.c, 2 * v.bigR + 2, [sign * v.boltX, 0, -v.bigR - 1], 'z'));
      cuts.push(cylinder(v.bolt + v.c, v.bigR + 2, [sign * v.boltX, 0, v.grip / 2], 'z'));
      cuts.push(
        cylinder(
          v.bolt * 0.85 + v.c,
          v.bigR + 2,
          [sign * v.boltX, 0, -v.grip / 2 - v.bigR - 2],
          'z',
        ),
      );
    }
  const z0 = v.pocketStart,
    z1 = v.pocketEnd,
    height = z1 - z0;
  if (p.section === 'i-beam') {
    const widthAt = (z: number) =>
      n(p, 'shankWidth') +
      ((n(p, 'smallShankWidth') - n(p, 'shankWidth')) * (z - v.beamStart)) /
        (v.beamEnd - v.beamStart);
    const lower = widthAt(z0) / 2 - n(p, 'flangeThickness'),
      upper = widthAt(z1) / 2 - n(p, 'flangeThickness'),
      web = n(p, 'webThickness');
    const outline: [number, number][] = [
      [-lower, z0],
      [lower, z0],
      [upper, z1],
      [-upper, z1],
    ];
    cuts.push(prism(outline, (v.beamT - web) / 2 + 1, web / 2));
    cuts.push(prism(outline, (v.beamT - web) / 2 + 1, -v.beamT / 2 - 1));
  } else if (p.section === 'h-beam') {
    const limit = Math.max(n(p, 'shankWidth'), n(p, 'smallShankWidth')) + 2,
      web = n(p, 'webThickness'),
      innerY = v.beamT - 2 * n(p, 'flangeThickness');
    cuts.push(box([limit, innerY, height], [web / 2, -innerY / 2, z0]));
    cuts.push(box([limit, innerY, height], [-limit - web / 2, -innerY / 2, z0]));
  }
  return subtract(union(...pieces), ...cuts);
}
type RodComponent = { shape: Shape; label: string; color: number; shift: Vec };
const finish: Record<string, number> = { steel: 0x929ba5, aluminum: 0xbdc4cd, black: 0x3a424b };
export function rodAssembly(p: Parameters, state: string): RodComponent[] {
  const v = rodValues(p),
    split = p.bigEnd === 'split-cap',
    full = completeRod(p),
    explode = state === 'exploded';
  const body = split ? half(p, full, true, n(p, 'splitGap')) : full;
  const components: RodComponent[] = [
    {
      shape: body,
      label: 'Connecting rod body',
      color: finish[String(p.finish)],
      shift: [0, 0, 0],
    },
  ];
  if (state === 'body') return components;
  const capShift = explode ? -v.bigR * 1.15 : 0,
    shellShift = explode ? -v.bigR * 0.5 : 0;
  if (split)
    components.push({
      shape: half(p, full, false, n(p, 'splitGap')),
      label: 'Big-end bearing cap',
      color: finish[String(p.finish)],
      shift: [0, 0, capShift],
    });
  if (p.smallBushing) {
    const w = v.smallW - 2 * v.c,
      bushing = subtract(
        cylinder(n(p, 'smallBore') / 2 + n(p, 'bushingThickness'), w, [0, -w / 2, v.C]),
        cylinder(n(p, 'smallBore') / 2, w + 2, [0, -w / 2 - 1, v.C]),
      );
    components.push({
      shape: bushing,
      label: 'Small-end bushing',
      color: 0xb38b43,
      shift: [0, explode ? v.smallW * 1.5 : 0, 0],
    });
  }
  if (p.bigBearing === 'shells') {
    const w = v.bigW - 2 * v.c,
      shell = subtract(
        cylinder(n(p, 'bigBore') / 2 + n(p, 'shellThickness'), w, [0, -w / 2, 0]),
        cylinder(n(p, 'bigBore') / 2, w + 2, [0, -w / 2 - 1, 0]),
      );
    components.push({
      shape: half(p, shell, true, v.c),
      label: 'Upper bearing shell',
      color: 0xc7cacf,
      shift: [0, explode ? v.bigW * 1.5 : 0, 0],
    });
    components.push({
      shape: half(p, shell, false, v.c),
      label: 'Lower bearing shell',
      color: 0xc7cacf,
      shift: [0, split ? 0 : explode ? v.bigW * 1.5 : 0, shellShift],
    });
  }
  if (split && p.includeHardware) {
    const headH = v.bolt * 0.65,
      headTop = -v.grip / 2 - v.c,
      nutH = v.bolt * 0.8,
      nutBottom = v.grip / 2 + v.c,
      shaftEnd = nutBottom + nutH + v.bolt * 0.25;
    for (const [index, sign] of [-1, 1].entries()) {
      const x = sign * v.boltX;
      const bolt = subtract(
        union(
          cylinder(v.bolt / 2, shaftEnd - headTop + 0.02, [x, 0, headTop - 0.02], 'z'),
          cylinder(v.bolt * 0.85, headH, [x, 0, headTop - headH], 'z'),
        ),
        cylinder(v.bolt * 0.3, headH * 0.55 + 0.1, [x, 0, headTop - headH - 0.1], 'z', 6),
      );
      const nut = subtract(
        cylinder(v.bolt, nutH, [x, 0, nutBottom], 'z', 6),
        cylinder(v.bolt / 2 + v.c, nutH + 0.2, [x, 0, nutBottom - 0.1], 'z'),
      );
      components.push({
        shape: bolt,
        label: `Cap bolt ${index + 1}`,
        color: 0x464e58,
        shift: [0, 0, explode ? capShift - v.bigR * 0.5 : 0],
      });
      components.push({
        shape: nut,
        label: `Cap nut ${index + 1}`,
        color: 0x757e88,
        shift: [0, 0, explode ? v.bigR * 0.9 : 0],
      });
    }
  }
  return components;
}
export function assemblyBounds(p: Parameters, state: string): Bounds {
  const low: Vec = [Infinity, Infinity, Infinity],
    high: Vec = [-Infinity, -Infinity, -Infinity];
  for (const c of rodAssembly(p, state)) {
    const b = bounds(c.shape);
    for (let i = 0; i < 3; i++) {
      low[i] = Math.min(low[i], b[0][i] + c.shift[i]);
      high[i] = Math.max(high[i], b[1][i] + c.shift[i]);
    }
  }
  return [low, high];
}
const part: PartDefinition = {
  id: 'connecting-rod',
  name: 'Connecting rod',
  category: 'TRANSMISSION & LINKAGES',
  subgroup: 'PISTONS & CONNECTING RODS',
  icon: 'bracket',
  complexity: 'Rod + cap + bearing inserts',
  description:
    'Configurable connecting rod with parallel pin and journal bores, real I/H-beam pockets and independently removable cap, bearing shells and fasteners.',
  keywords: [
    'connecting rod',
    'conrod',
    'piston rod',
    'compressor',
    'engine',
    'crank',
    'linkage',
    'small end',
    'big end',
    'bearing cap',
    'I-beam',
    'H-beam',
  ],
  defaults,
  parameters,
  presets: presetData as Preset[],
  presetMatchKeys: ['centerDistance', 'smallBore', 'bigBore', 'bigEnd', 'section'],
  states: [
    {
      id: 'assembled',
      label: 'Assembled',
      description: 'Rod, cap, inserts, bolts and nuts at their assembled positions.',
    },
    {
      id: 'exploded',
      label: 'Exploded',
      description: 'Separate cap, shells, small-end bushing and fasteners for inspection.',
    },
    {
      id: 'body',
      label: 'Rod body only',
      description: 'The manufactured rod body, excluding its cap and all removable inserts.',
    },
  ],
  validate(p) {
    const v = rodValues(p),
      errors: string[] = [];
    if (v.C <= v.bigR + v.smallR + 9)
      errors.push(
        'Increase center distance to leave room between the eye housings and shank pockets.',
      );
    if (v.beamT > Math.min(v.bigW, v.smallW))
      errors.push('Shank thickness must not exceed either eye width.');
    if (n(p, 'shankWidth') > v.bigR * 2 - 1 || n(p, 'smallShankWidth') > v.smallR * 2 - 1)
      errors.push('Shank widths must fit within their respective eye housings.');
    if (p.section === 'i-beam') {
      if (n(p, 'webThickness') >= v.beamT - 0.5)
        errors.push('The I-beam web must leave positive face-pocket depth.');
      if (n(p, 'flangeThickness') * 2 >= Math.min(n(p, 'shankWidth'), n(p, 'smallShankWidth')) - 1)
        errors.push('I-beam flanges must leave a pocket between both side flanges.');
    }
    if (p.section === 'h-beam') {
      if (n(p, 'webThickness') >= Math.min(n(p, 'shankWidth'), n(p, 'smallShankWidth')) - 0.5)
        errors.push('The H-beam web must leave pockets along both sides.');
      if (n(p, 'flangeThickness') * 2 >= v.beamT - 0.5)
        errors.push('H-beam flanges must leave a side pocket between them.');
    }
    if (p.bigEnd === 'split-cap') {
      if (v.boltX - v.bolt / 2 - v.c <= v.bigHousing / 2 + 0.4)
        errors.push('Cap bolt bores need material between the bolt and journal housing.');
      if (v.boltX - v.lugWidth / 2 >= v.bigR - 0.5)
        errors.push('Cap bolt lugs must overlap the big-eye housing. Reduce bolt spacing.');
      if (v.bolt * 2 + 2 * v.c >= v.bigW)
        errors.push('Big-eye width must contain the bolt and nut seats.');
      if (v.grip / 2 >= v.bigR - 0.5 || v.grip < 2 * v.bolt)
        errors.push(
          'Bolt-seat spacing must be at least two bolt diameters and fit within the big eye.',
        );
      if (Math.hypot(v.boltX - v.bolt - v.c, v.grip / 2) <= v.bigHousing / 2 + 0.3)
        errors.push('Bolt seats must not open into the journal housing.');
      if (n(p, 'splitGap') >= v.grip * 0.1)
        errors.push('Cap split clearance is too large for the bolt seats.');
    }
    return errors;
  },
  buildGeometry(p, state) {
    const group = new Group();
    for (const c of rodAssembly(p, state)) {
      const mesh = component(c.shape, c.label, c.color);
      mesh.position.add({ x: c.shift[0], y: c.shift[1], z: c.shift[2] });
      group.add(mesh);
    }
    return group;
  },
  python(p, state) {
    const lines = [
      '# Connecting rod prototype; the supplied anatomy images establish no dimensions.',
      '# Cap fastener threads are smooth envelopes. Working bores and housing bores are distinct.',
      pythonHelpers,
      'components = []',
      'component_labels = []',
      'component_colors = []',
    ];
    for (const c of rodAssembly(p, state)) {
      lines.push(`item = ${pythonShape(c.shape)}.removeSplitter()`);
      if (c.shift.some((v) => v !== 0))
        lines.push(`item.translate(App.Vector(${c.shift.map(num).join(',')}))`);
      lines.push(
        'if item.isNull() or not item.isValid() or len(item.Solids) != 1: raise ValueError("A connecting rod component failed solid validation.")',
        'components.append(item)',
        `component_labels.append(${JSON.stringify(c.label)})`,
        `component_colors.append((${[(c.color >> 16) & 255, (c.color >> 8) & 255, c.color & 255].map((v) => num(v / 255)).join(',')}))`,
      );
    }
    lines.push('shape = Part.makeCompound(components)');
    return lines.join('\n');
  },
  dimensions(p, state) {
    const b = assemblyBounds(p, state);
    return b[1].map((v, i) => v - b[0][i]) as Vec;
  },
  updateParameters(p, key) {
    if (key === 'section' && p.section !== 'solid') {
      const width = Math.min(n(p, 'shankWidth'), n(p, 'smallShankWidth'));
      const webLimit = p.section === 'i-beam' ? n(p, 'shankThickness') : width;
      const flangeLimit = p.section === 'i-beam' ? width : n(p, 'shankThickness');
      return {
        ...p,
        webThickness: Math.max(1, Math.min(n(p, 'webThickness'), webLimit / 2)),
        flangeThickness: Math.max(1, Math.min(n(p, 'flangeThickness'), flangeLimit / 4)),
      };
    }
    if (
      ['bigEnd', 'bigBore', 'shellThickness', 'bigBearing', 'bigWall', 'boltDiameter'].includes(key)
    ) {
      const next =
        key === 'bigEnd' && p.bigEnd === 'split-cap'
          ? {
              ...p,
              boltDiameter: Math.max(
                2,
                Math.min(n(p, 'boltDiameter'), Math.floor(n(p, 'bigWidth') * 0.6) / 2),
              ),
            }
          : p;
      const v = rodValues(next);
      return {
        ...next,
        boltSpacing: 2 * (v.bigR + v.bolt * 0.25),
        boltGrip: Math.max(6, v.bolt * 2, Math.min(n(p, 'boltGrip'), 2 * (v.bigR - 1))),
      };
    }
    return p;
  },
  notes:
    'All presets are editable dimensional examples. The supplied anatomy and exploded illustrations establish component names and arrangement only. No engine fit, supplier dimensions, standard, strength, fatigue life or load rating is claimed. Pin and journal bores are finished working diameters; fitted inserts enlarge the rod housing by their thickness and the chosen clearance. Bolts and nuts use smooth thread envelopes. Small geometric clearances separate components. No oil channels, bearing locating tangs, fillets or balancing/mass target are modeled.',
  sources: [
    { label: 'Supplied connecting rod anatomy', url: '' },
    {
      label: 'Supplied piston and rod exploded assembly',
      url: '',
    },
  ],
};
export default withParameterStates(part, {
  body: ['includeHardware'],
});
