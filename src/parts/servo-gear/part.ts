import { Group, Vector2, Vector3 } from 'three';
import { n, num } from '../../core/geometry';
import { BoundaryMesh } from '../../core/mechanical';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import { catalogSelection, defaults, parameters } from './configurator';
import { involuteProfile } from './lib/profile';
import presetData from './presets.json';

export function gearValues(p: Parameters) {
  const module = n(p, 'module'),
    teeth = n(p, 'teeth');
  const angle = (n(p, 'pressureAngle') * Math.PI) / 180;
  const pitchRadius = (module * teeth) / 2;
  return {
    teeth,
    angle,
    pitchRadius,
    baseRadius: pitchRadius * Math.cos(angle),
    rootRadius: pitchRadius - 1.25 * module,
    tipRadius: pitchRadius + module,
    halfThickness: Math.PI / (2 * teeth) - n(p, 'backlash') / (4 * pitchRadius),
  };
}

const circle = (radius: number) =>
  Array.from(
    { length: 96 },
    (_, i) =>
      new Vector2(radius * Math.cos((i * Math.PI) / 48), radius * Math.sin((i * Math.PI) / 48)),
  );
const at = (points: Vector2[], z: number) => points.map((p) => new Vector3(p.x, p.y, z));
const up = new Vector3(0, 0, 1),
  down = new Vector3(0, 0, -1);

/** Editable serration envelope, not a manufacturer-specific involute spline. */
export function splineOutline(p: Parameters): Vector2[] {
  const count = n(p, 'splineTeeth'),
    phase = (n(p, 'splineAngle') * Math.PI) / 180;
  return Array.from({ length: count * 2 }, (_, i) => {
    const angle = phase + (i * Math.PI) / count;
    const radius = n(p, i % 2 ? 'splineMinor' : 'splineMajor') / 2;
    return new Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
  });
}

function socketSections(p: Parameters) {
  const bottom = p.hub ? -n(p, 'hubExtension') : 0,
    top = n(p, 'faceWidth');
  const spline = splineOutline(p),
    bore = circle(n(p, 'screwBore') / 2);
  if (p.socket === 'through') return [{ points: spline, bottom, top }];
  const shoulder = bottom + n(p, 'socketDepth');
  const recess = p.counterbore ? top - n(p, 'counterboreDepth') : top;
  const sections = [
    { points: spline, bottom, top: shoulder },
    { points: bore, bottom: shoulder, top: recess },
  ];
  if (p.counterbore)
    sections.push({ points: circle(n(p, 'counterboreDiameter') / 2), bottom: recess, top });
  return sections;
}

const part: PartDefinition = {
  id: 'servo-gear',
  name: 'Servo spline gear',
  category: 'MOTION',
  subgroup: 'SERVO LINKAGES',
  icon: 'gear',
  complexity: 'Involute gear · servo spline',
  description:
    'A servo output gear with independent external teeth and internal spline, a retaining screw opening and an optional extended hub.',
  keywords: [
    'servo',
    'horn',
    'spline',
    'gear',
    'pinion',
    '24T',
    '25T',
    'Hitec',
    'Futaba',
    'Actobotics',
    'goBILDA',
  ],
  parameters,
  defaults,
  catalogSelection,
  presets: presetData as Preset[],
  presetMatchKeys: ['splineTeeth', 'module', 'teeth', 'faceWidth'],
  states: [
    {
      id: 'default',
      label: 'Gear face',
      description: 'External gear teeth and retaining screw opening.',
    },
    {
      id: 'socket-up',
      label: 'Spline socket side',
      description: 'Turn the gear over to inspect its servo connection.',
    },
  ],
  validate(p) {
    const errors: string[] = [],
      v = gearValues(p);
    const depth = n(p, 'faceWidth') + (p.hub ? n(p, 'hubExtension') : 0);
    if (!Number.isInteger(v.teeth) || !Number.isInteger(n(p, 'splineTeeth')))
      errors.push('Gear and spline tooth counts must be integers.');
    if (p.profileMode !== 'layout' && v.teeth < Math.ceil(2 / Math.sin(v.angle) ** 2))
      errors.push(
        'Increase the tooth count or pressure angle: this unshifted profile does not reproduce cutter undercut.',
      );
    if (n(p, 'backlash') >= (Math.PI * n(p, 'module')) / 3)
      errors.push('Backlash must be less than one third of the circular pitch.');
    const t = Math.sqrt((v.tipRadius / v.baseRadius) ** 2 - 1);
    if (v.halfThickness + Math.tan(v.angle) - v.angle - (t - Math.atan(t)) <= 0.002)
      errors.push('These dimensions produce pointed tooth tips.');
    if (n(p, 'splineMinor') >= n(p, 'splineMajor'))
      errors.push('Spline minor diameter must be smaller than its major diameter.');
    if (n(p, 'splineMajor') / 2 + 0.5 >= v.rootRadius)
      errors.push('Leave at least 0.5 mm of material below the external tooth roots.');
    if (
      p.hub &&
      (n(p, 'hubDiameter') <= n(p, 'splineMajor') + 1 || n(p, 'hubDiameter') >= v.rootRadius * 2)
    )
      errors.push(
        'The hub must surround the spline with at least 0.5 mm wall and fit below the tooth roots.',
      );
    if (p.socket === 'blind') {
      if (n(p, 'screwBore') >= n(p, 'splineMinor') - 0.5)
        errors.push('The retaining screw bore must leave a shoulder inside the spline.');
      if (n(p, 'socketDepth') + (p.counterbore ? n(p, 'counterboreDepth') : 0) > depth - 0.5)
        errors.push('Keep at least 0.5 mm of web between the spline and the screw-head recess.');
      if (
        p.counterbore &&
        (n(p, 'counterboreDiameter') <= n(p, 'screwBore') ||
          n(p, 'counterboreDiameter') / 2 + 0.5 >= v.rootRadius)
      )
        errors.push('The head recess must surround the screw hole and fit below the tooth roots.');
      if (p.counterbore && n(p, 'counterboreDepth') >= n(p, 'faceWidth'))
        errors.push('The screw-head recess must remain within the gear face width.');
    }
    return errors;
  },
  buildGeometry(p, state) {
    const outline = involuteProfile(gearValues(p)).points,
      top = n(p, 'faceWidth');
    const sections = socketSections(p),
      mesh = new BoundaryMesh();
    mesh.bridge(at(outline, 0), at(outline, top));
    if (p.hub) {
      const hub = circle(n(p, 'hubDiameter') / 2);
      mesh.bridge(at(hub, sections[0].bottom), at(hub, 0));
      mesh.face(at(outline, 0), [at(hub, 0)], down);
      mesh.face(at(hub, sections[0].bottom), [at(sections[0].points, sections[0].bottom)], down);
    } else mesh.face(at(outline, 0), [at(sections[0].points, 0)], down);
    for (const section of sections)
      mesh.bridge(at(section.points, section.bottom), at(section.points, section.top), true);
    if (sections.length > 1)
      mesh.face(
        at(sections[0].points, sections[0].top),
        [at(sections[1].points, sections[0].top)],
        down,
      );
    if (sections.length > 2)
      mesh.face(
        at(sections[2].points, sections[2].bottom),
        [at(sections[1].points, sections[2].bottom)],
        up,
      );
    mesh.face(at(outline, top), [at(sections.at(-1)!.points, top)], up);
    const body = mesh.build(0xbfa45f);
    body.name = 'Servo gear';
    const group = new Group().add(body);
    if (state === 'socket-up') group.rotation.x = Math.PI;
    return group;
  },
  python(p, state) {
    const profile = involuteProfile(gearValues(p));
    const segments = JSON.stringify(
      profile.segments.map((s) => [
        s.kind,
        s.points.map((point) => point.map((v) => Number(num(v)))),
      ]),
    );
    const bottom = p.hub ? -n(p, 'hubExtension') : 0,
      width = n(p, 'faceWidth');
    const socketDepth = p.socket === 'through' ? width - bottom + 2 : n(p, 'socketDepth') + 1;
    const spline = JSON.stringify(
      splineOutline(p).map((point) => [Number(num(point.x)), Number(num(point.y))]),
    );
    return `profile_segments = ${segments}
edges = []
for kind, coordinates in profile_segments:
    points = [App.Vector(x, y, 0) for x, y in coordinates]
    if kind == "line":
        edges.append(Part.makeLine(points[0], points[-1]))
    elif kind == "arc":
        edges.append(Part.Arc(points[0], points[len(points) // 2], points[-1]).toShape())
    else:
        curve = Part.BSplineCurve()
        curve.interpolate(points)
        edges.append(curve.toShape())
shape = Part.Face(Part.Wire(edges)).extrude(App.Vector(0, 0, ${num(width)}))
${p.hub ? `shape = shape.fuse(Part.makeCylinder(${num(n(p, 'hubDiameter') / 2)}, ${num(-bottom)}, App.Vector(0, 0, ${num(bottom)})))` : ''}
spline_points = [App.Vector(x, y, ${num(bottom - 1)}) for x, y in ${spline}]
spline_wire = Part.makePolygon(spline_points + [spline_points[0]])
socket = Part.Face(spline_wire).extrude(App.Vector(0, 0, ${num(socketDepth)}))
shape = shape.cut(socket)
${
  p.socket === 'blind'
    ? `screw_bore = Part.makeCylinder(${num(n(p, 'screwBore') / 2)}, ${num(width - bottom + 2)}, App.Vector(0, 0, ${num(bottom - 1)}))
shape = shape.cut(screw_bore)`
    : ''
}
${
  p.socket === 'blind' && p.counterbore
    ? `head_recess = Part.makeCylinder(${num(n(p, 'counterboreDiameter') / 2)}, ${num(n(p, 'counterboreDepth') + 1)}, App.Vector(0, 0, ${num(width - n(p, 'counterboreDepth'))}))
shape = shape.cut(head_recess)`
    : ''
}
shape = shape.removeSplitter()
${state === 'socket-up' ? 'shape.rotate(App.Vector(0, 0, 0), App.Vector(1, 0, 0), 180)' : ''}`;
  },
  dimensions(p) {
    const points = involuteProfile(gearValues(p)).points;
    return [
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
      n(p, 'faceWidth') + (p.hub ? n(p, 'hubExtension') : 0),
    ];
  },
  notes:
    'External teeth use sampled involute flanks. The internal serration is an editable prototype envelope: tooth count alone does not establish servo compatibility. Socket diameters, depth and screw-head recess are not dimensioned in the supplied drawings. Measure the actual servo shaft before manufacturing a mating part.',
  sources: [
    {
      label: 'ServoCity · 2305 24T-spline 20-tooth gear',
      url: 'https://www.servocity.com/2305-series-brass-mod-0-8-servo-gear-24-tooth-spline-20-tooth/',
    },
    {
      label: 'ServoCity · 2305 24T-spline 30-tooth gear',
      url: 'https://www.servocity.com/2305-series-brass-mod-0-8-servo-gear-24-tooth-spline-30-tooth/',
    },
  ],
};
export default part;
