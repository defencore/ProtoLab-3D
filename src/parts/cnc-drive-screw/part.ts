import { Group } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import sourceScrew from '../ball-screw/part';
import {
  cylinder,
  subtract,
  union,
  boundaryThreadCallouts,
  type Shape,
} from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import { threadMetadata } from '../../core/thread-callouts';
import { currentGeometryMode } from '../../core/geometry-mode';
import product from './product.json';
import presets from './presets.json';
export function driveScrewParameters(racewayLength = 1800): Parameters {
  return { racewayLength };
}
export function driveScrewLayout(p: Parameters) {
  const length = Number(p.racewayLength),
    start = -length / 2,
    end = length / 2;
  return {
    racewayLength: length,
    racewayStart: start,
    racewayEnd: end,
    fixedShoulder: start,
    freeShoulder: end,
    fixedSupportCenter: start - 13,
    freeSupportCenter: end + 4,
    overallLength: length + 62,
    driveJournal: { start: start - 51, end: start - 36, diameter: 10 },
    fixedJournal: { start: start - 36, end: start, diameter: 12 },
    thread: { start: start - 36, end: start - 24, diameter: 12, pitch: 1 },
    freeJournal: { start: end, end: end + 11, diameter: 10 },
    groove: { start: end + 8, end: end + 9.15, diameter: 9.6 },
    minimum: -length / 2 - 51,
    maximum: length / 2 + 11,
  };
}
function coreParameters(p: Parameters): Parameters {
  const selected = sourceScrew.presets.find((row) => row.id === 'sfu1610-3-200');
  if (!selected) throw new Error('Required SFU1610-3 source configuration is absent.');
  return {
    ...sourceScrew.defaults,
    ...selected.parameters,
    length: Number(p.racewayLength),
    endMachining: 'none',
    nutPosition: 50,
    rotation: 0,
  };
}
function groovedBlankPython(p: Parameters): string {
  const core = coreParameters(p);
  if (currentGeometryMode() === 'simple') return sourceScrew.python(core, 'screw');
  const period = 200,
    length = Number(p.racewayLength),
    radius = Number(core.shaftDiameter) / 2,
    lead = Number(core.lead),
    hand = core.hand === 'left' ? -1 : 1;
  // Repeated bounded source profiles avoid the outside-point classification failure of one long sweep.
  // Rotation compensates translation, preserving the source helix phase even for a partial final period.
  return `${sourceScrew.python({ ...core, length: period }, 'screw')}
_cnc_source_period=components[0]
_cnc_segments=[]
for _cnc_index in range(${Math.ceil(length / period)}):
    _cnc_start=${-length / 2}+_cnc_index*${period}
    _cnc_center=_cnc_start+${period / 2}
    _cnc_segment=_cnc_source_period.copy()
    _cnc_angle=(${(hand * 360) / lead}*_cnc_center)%360
    if abs(_cnc_angle)>1e-9: _cnc_segment.rotate(App.Vector(),App.Vector(0,0,1),_cnc_angle)
    _cnc_segment.translate(App.Vector(0,0,_cnc_center))
    _cnc_span=min(${period},${length / 2}-_cnc_start)
    if _cnc_span<${period}-1e-9:
        _cnc_segment=_cnc_segment.common(Part.makeBox(${2 * radius + 2},${2 * radius + 2},_cnc_span,App.Vector(${-radius - 1},${-radius - 1},_cnc_start)))
    _cnc_segments.append(_cnc_segment)
while len(_cnc_segments)>1:
    _cnc_segments=[_cnc_segments[index].fuse(_cnc_segments[index+1]) if index+1<len(_cnc_segments) else _cnc_segments[index] for index in range(0,len(_cnc_segments),2)]
components=[_cnc_segments[0]]`;
}
function endShape(p: Parameters): Shape {
  const v = driveScrewLayout(p);
  const fixed: Shape = {
    kind: 'cylinder',
    radius: 6,
    height: 12,
    origin: [v.thread.start, 0, 0],
    axis: 'x',
    thread: { pitch: 1, designation: 'M12x1' },
  };
  const free = subtract(
    cylinder(5, 11, [v.freeJournal.start, 0, 0], 'x'),
    subtract(
      cylinder(5.1, 1.15, [v.groove.start, 0, 0], 'x'),
      cylinder(4.8, 3.15, [v.groove.start - 1, 0, 0], 'x'),
    ),
  );
  return union(
    cylinder(5, 15, [v.driveJournal.start, 0, 0], 'x'),
    fixed,
    cylinder(6, 24, [v.thread.end, 0, 0], 'x'),
    free,
  );
}
function endPieces(p: Parameters): Piece[] {
  return [{ label: 'Machined BK12/BF12 screw ends', color: 0xb0b7bc, shape: endShape(p) }];
}
const part: PartDefinition = {
  id: 'cnc-drive-screw',
  name: 'Machined ballscrew with retained ends',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'SFU1610 blank with retained Ø12 / Ø10 ends',
  description:
    'One SFU1610 screw machined from a purchased blank to documented BK12/BF12 journal and retention interfaces.',
  keywords: ['CNC', 'SFU1610', 'ball screw', 'BK12', 'BF12', 'M12x1', 'machined journals'],
  defaults: driveScrewParameters(),
  parameters: [
    {
      key: 'racewayLength',
      label: 'Active grooved shaft length',
      type: 'number',
      unit: 'mm',
      group: 'Manufacture',
      min: 150,
      max: 1938,
      step: 1,
    },
  ],
  presets: presets as Preset[],
  validate(p) {
    const length = Number(p.racewayLength);
    if (!Number.isFinite(length) || length < 150 || length > 1938)
      return ['Choose an active shaft length150–1938 mm (overall length≤2000 mm).'];
    return sourceScrew.validate(coreParameters(p), 'screw');
  },
  buildGeometry(p) {
    const core = sourceScrew.buildGeometry(coreParameters(p), 'screw');
    core.rotation.y = Math.PI / 2;
    core.name = 'SFU1610 grooved screw blank';
    return new Group().add(core, geometry(endPieces(p)));
  },
  buildExportGeometry(p) {
    return part.buildGeometry(p, 'default');
  },
  python(p) {
    const source = groovedBlankPython(p);
    return `${source}\n_cnc_screw_base=components[0]\n_cnc_screw_base.rotate(App.Vector(),App.Vector(0,1,0),90)\n${python(endPieces(p))}\nshape=_cnc_screw_base.fuse(components[0])\nif not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1 or shape.Volume<=0: raise ValueError("Machined CNC screw must be one valid closed solid.")\ncomponents=[shape]\ncomponent_labels=["SFU1610 screw with retained BK12/BF12 end machining"]\ncomponent_metadata=[${JSON.stringify(threadMetadata(boundaryThreadCallouts(endShape(p))))}]`;
  },
  dimensions: (p) => [Number(p.racewayLength) + 62, 16, 16],
  notes:
    'Native axis X; grooved span centered0. Fixed side: Ø12×36 journal with M12×1 first12 mm, plus Ø10×15 drive projection. Supported side: Ø10×11 journal, Ø9.6 groove from8 to9.15 mm from shoulder. HIWIN B03TE03-1907 printed pp23/25 gives E/S/F/G and nominal diameters; MISUMI JIS B2804 supports grooveØ9.6. Fixed end machining leaves the body shoulder at BK collar contactX13; the chosen reconstructed support bearing datum is disclosed in its package. Raceway geometry reuses the actual SFU1610-3 library model; its production groove/contact/return limitations remain applicable. This is a custom machined detail, not a factory-finished screw or a sourced finished SKU. Specify the blank vendor, machining tolerances, shoulder radii, runout, surface finish, thread fit and the ordered nut/preload execution before manufacture.',
  sources: [
    {
      label: 'HIWIN suggested BK/BF shaft-end machining, printed pp23/25',
      url: 'https://www.hiwin.com/wp-content/uploads/HIWIN-Ballscrew-Supports-Catalog.pdf',
    },
    {
      label: 'MISUMI JIS external retaining-ring grooveØ9.6×1.15',
      url: 'https://sg.misumi-ec.com/pdf/tech/mech/p2855.pdf',
    },
  ],
};
export default part;
