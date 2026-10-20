import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Parameters, PartDefinition, Preset } from '../../core/types';
import type { ProductProfile } from '../../core/product-types';
import { boundaryThreadCallouts, cylinder, subtract, union, type Shape } from '../../core/assembly/boundary/shapes';
import { geometry, python, type Piece } from '../../core/assembly/boundary/assembly';
import { currentGeometryMode } from '../../core/geometry-mode';
import { threadMetadata } from '../../core/thread-callouts';
import {
  precisionNutLayout,
  precisionScrewSource,
  type PrecisionScrewModel,
} from '../cnc-precision-nut/part';
import product from './product.json';
import presets from './presets.json';
export function precisionScrewParameters(
  model: PrecisionScrewModel = 'r25-10t3-fdi',
  racewayLength = 1800,
  driveExtension = 0,
): Parameters {
  return { model, racewayLength, driveExtension };
}
export function precisionScrewLayout(p: Parameters) {
  const v = precisionNutLayout(p),
    large = v.shaftDiameter === 25,
    length = Number(p.racewayLength),
    start = -length / 2,
    end = length / 2;
  const fixed = large ? 53 : 40,
    free = large ? 16 : 13,
    journal = large ? 20 : 15,
    retention = large ? 15 : 12,
    extension = Number(p.driveExtension);
  return {
    ...v,
    racewayLength: length,
    racewayStart: start,
    racewayEnd: end,
    fixedShoulder: start,
    freeShoulder: end,
    fixedSupportCenter: start - (large ? 17.5 : 13.5),
    freeSupportCenter: end + (large ? 6 : 4.5),
    fixedJournal: { start: start - fixed, end: start, diameter: journal },
    driveJournal: {
      start: start - fixed - 25 - extension,
      end: start - fixed - extension,
      diameter: journal,
    },
    thread: { start: start - fixed, end: start - fixed + retention, diameter: journal, pitch: 1 },
    freeJournal: { start: end, end: end + free, diameter: journal },
    groove: {
      start: end + (large ? 12 : 9),
      end: end + (large ? 13.35 : 10.15),
      diameter: large ? 18.6 : 14.3,
    },
    driveExtension: extension,
    minimum: start - fixed - 25 - extension,
    maximum: end + free,
    overallLength: length + fixed + 25 + free + extension,
  };
}
function ends(p: Parameters, threaded: boolean): Piece[] {
  const v = precisionScrewLayout(p);
  const retention: Shape = {
    kind: 'cylinder',
    radius: v.thread.diameter / 2,
    height: v.thread.end - v.thread.start,
    origin: [v.thread.start, 0, 0],
    axis: 'x',
    ...(threaded ? { thread: { pitch: 1, designation: `M${v.thread.diameter}x1` } } : {}),
  };
  const free = subtract(
    cylinder(
      v.freeJournal.diameter / 2,
      v.freeJournal.end - v.freeJournal.start,
      [v.freeJournal.start, 0, 0],
      'x',
    ),
    subtract(
      cylinder(
        v.freeJournal.diameter / 2 + 0.1,
        v.groove.end - v.groove.start,
        [v.groove.start, 0, 0],
        'x',
      ),
      cylinder(
        v.groove.diameter / 2,
        v.groove.end - v.groove.start + 2,
        [v.groove.start - 1, 0, 0],
        'x',
      ),
    ),
  );
  const members: Shape[] = [
    cylinder(v.driveJournal.diameter / 2, 25, [v.driveJournal.start, 0, 0], 'x'),
    retention,
    cylinder(
      v.fixedJournal.diameter / 2,
      v.fixedJournal.end - v.thread.end,
      [v.thread.end, 0, 0],
      'x',
    ),
    free,
  ];
  if (v.driveExtension > 0)
    members.push(
      cylinder(v.driveJournal.diameter / 2, v.driveExtension, [v.driveJournal.end, 0, 0], 'x'),
    );
  return [
    {
      label:
        'Factory machined bearing, retention and drive interfaces; approved end drawing required',
      color: 0xaeb7bf,
      shape: union(...members),
    },
  ];
}
function raceway(p: Parameters): Group {
  const v = precisionScrewLayout(p);
  if (currentGeometryMode() === 'simple')
    return geometry([
      {
        label: 'Ground shaft nominal envelope; factory raceway not reconstructed',
        color: 0xb5bec6,
        shape: cylinder(v.shaftDiameter / 2, v.racewayLength, [v.racewayStart, 0, 0], 'x'),
      },
    ]);
  const around = 48,
    layers = Math.ceil((v.racewayLength / v.lead) * 24),
    br = v.ballDiameter / 2,
    track = v.rootDiameter / 2 + br;
  const points: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= layers; j++) {
    const x = v.racewayStart + (j * v.racewayLength) / layers;
    for (let i = 0; i < around; i++) {
      const a = (i * 2 * Math.PI) / around,
        // Native CAD turns its Z helix onto X with RY(+90): (r cos t,r sin t,z)
        // becomes (z,r sin t,-r cos t), so the groove is at t-pi/2 in the YZ plane.
        phase = a + Math.PI / 2 - (2 * Math.PI * x) / v.lead;
      const delta =
        (((Math.atan2(Math.sin(phase), Math.cos(phase)) * v.lead) / (2 * Math.PI)) * track) /
        Math.hypot(track, v.lead / (2 * Math.PI));
      const r =
        Math.abs(delta) < br
          ? Math.min(v.shaftDiameter / 2, track - Math.sqrt(br * br - delta * delta))
          : v.shaftDiameter / 2;
      points.push(x, r * Math.cos(a), r * Math.sin(a));
      if (j < layers) {
        const k = j * around + i,
          b = j * around + ((i + 1) % around);
        indices.push(k, b, k + around, b, b + around, k + around);
      }
    }
  }
  for (const [j, reverse] of [
    [0, true],
    [layers, false],
  ] as const) {
    const center = points.length / 3;
    points.push(j === 0 ? v.racewayStart : v.racewayEnd, 0, 0);
    for (let i = 0; i < around; i++) {
      const a = j * around + i,
        b = j * around + ((i + 1) % around);
      indices.push(...(reverse ? [center, b, a] : [center, a, b]));
    }
  }
  const mesh = new BufferGeometry();
  mesh.setAttribute('position', new Float32BufferAttribute(points, 3));
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  const object = new Mesh(
    mesh,
    new MeshStandardMaterial({ color: 0xb5bec6, metalness: 0.65, roughness: 0.35 }),
  );
  object.name = 'Representative circular raceway; published root and lead only';
  return new Group().add(object);
}
function racewayPython(p: Parameters): string {
  const v = precisionScrewLayout(p);
  if (currentGeometryMode() === 'simple')
    return `shaft=Part.makeCylinder(${v.shaftDiameter / 2},${v.racewayLength},App.Vector(${v.racewayStart},0,0),App.Vector(1,0,0))`;
  const period = 100,
    br = v.ballDiameter / 2,
    track = v.rootDiameter / 2 + br;
  return `_pl_pitch=${v.lead}\n_pl_track=${track}\n_pl_br=${br}\n_pl_path=Part.Wire(Part.makeLongHelix(_pl_pitch,${period + 2 * v.lead},_pl_track,0,False).Edges)\n_pl_circle=Part.Wire([Part.Ellipse(App.Vector(_pl_track,0,_pl_br*math.hypot(_pl_track,_pl_pitch/(2*math.pi))/_pl_track),App.Vector(_pl_track+_pl_br,0,0),App.Vector(_pl_track,0,0)).toShape(.37,.37+2*math.pi)])\n_pl_tool=_pl_path.makePipeShell([_pl_circle],True,True)\nif _pl_tool.Volume<0: _pl_tool.reverse()\n_pl_tool.translate(App.Vector(0,0,${-period / 2 - v.lead}))\n_pl_source=Part.makeCylinder(${v.shaftDiameter / 2},${period},App.Vector(0,0,${-period / 2})).cut(_pl_tool)\n_pl_chunks=[]\nfor _pl_i in range(${Math.ceil(v.racewayLength / period)}):\n    _pl_start=${v.racewayStart}+_pl_i*${period}\n    _pl_center=_pl_start+${period / 2}\n    _pl_chunk=_pl_source.copy()\n    _pl_chunk.rotate(App.Vector(),App.Vector(0,0,1),(${360 / v.lead}*_pl_center)%360)\n    _pl_chunk.translate(App.Vector(0,0,_pl_center))\n    _pl_span=min(${period},${v.racewayEnd}-_pl_start)\n    if _pl_span<${period}: _pl_chunk=_pl_chunk.common(Part.makeBox(${v.shaftDiameter + 2},${v.shaftDiameter + 2},_pl_span,App.Vector(${-v.shaftDiameter / 2 - 1},${-v.shaftDiameter / 2 - 1},_pl_start)))\n    _pl_chunks.append(_pl_chunk)\nwhile len(_pl_chunks)>1:\n    _pl_chunks=[_pl_chunks[i].fuse(_pl_chunks[i+1]) if i+1<len(_pl_chunks) else _pl_chunks[i] for i in range(0,len(_pl_chunks),2)]\nshaft=_pl_chunks[0]\nshaft.rotate(App.Vector(),App.Vector(0,1,0),90)`;
}
const part: PartDefinition = {
  id: 'cnc-precision-screw',
  name: 'Ground precision drive screw',
  product: product as ProductProfile,
  category: 'LINEAR MOTION',
  subgroup: 'BALL SCREWS',
  icon: 'rail',
  complexity: 'HIWIN FDI matched ground shaft; retained custom ends',
  description:
    'Factory-ground HIWIN25×10/20×5 shaft interface with buyable matchingFDI nut and manufacturable source-derived BK/BF ends; C3 certificate remains a purchase requirement.',
  keywords: [
    'HIWIN',
    'FDI',
    'ground',
    'C3 order',
    'precision screw',
    '25x10',
    '20x5',
    'BK20',
    'BK15',
  ],
  defaults: precisionScrewParameters(),
  parameters: [
    {
      key: 'model',
      label: 'Matched nut/shaft execution',
      type: 'select',
      group: 'Model',
      options: [
        { value: 'r25-10t3-fdi', label: 'HIWIN R25-10T3-FDI ·25×10' },
        { value: 'r20-5t3-fdi', label: 'HIWIN R20-5T3-FDI ·20×5' },
      ],
    },
    {
      key: 'racewayLength',
      label: 'Ground raceway length',
      type: 'number',
      unit: 'mm',
      group: 'Order drawing',
      min: 200,
      max: 2200,
      step: 1,
    },
    {
      key: 'driveExtension',
      label: 'Custom smooth drive extension',
      type: 'number',
      unit: 'mm',
      group: 'Order drawing',
      min: 0,
      max: 150,
      step: 1,
      description:
        'Authored additional end machining between the retained bearing journal and coupling projection; requires factory approval.',
    },
  ],
  presets: presets as Preset[],
  validate(p) {
    const errors = ['r25-10t3-fdi', 'r20-5t3-fdi'].includes(String(p.model))
      ? []
      : ['Choose the actual HIWIN FDI execution.'];
    const l = p.racewayLength;
    if (typeof l !== 'number' || !Number.isFinite(l) || l < 200 || l > 2200)
      errors.push('Choose a finite ground raceway length200–2200mm.');
    const e = p.driveExtension;
    if (typeof e !== 'number' || !Number.isFinite(e) || e < 0 || e > 150)
      errors.push('Choose a finite custom drive extension0–150mm.');
    return errors;
  },
  buildGeometry: (p) => new Group().add(raceway(p), geometry(ends(p, true))),
  python(p) {
    const v = precisionScrewLayout(p), full = currentGeometryMode() === 'full';
    // Join continuous stock before cutting retention flanks. Fusing a separately
    // swept thread at its coincident end cap can leave an unorientable solid.
    const retentionCuts = full ? `\nif not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1 or shape.Volume<=0: raise ValueError("Continuous precision shaft stock must be one valid closed solid")\n_pl_retention_body=_protolab_thread(${v.thread.diameter},${v.thread.pitch},${v.thread.end - v.thread.start},False,False,0,False)\n_pl_retention_grooves=Part.makeCylinder(${v.thread.diameter / 2 + 0.01},${v.thread.end - v.thread.start}).cut(_pl_retention_body)\n_pl_retention_grooves.rotate(App.Vector(),App.Vector(0,1,0),90)\n_pl_retention_grooves.translate(App.Vector(${v.thread.start},0,0))\nshape=shape.cut(_pl_retention_grooves)\ncomponent_metadata[0].update(${JSON.stringify(threadMetadata(boundaryThreadCallouts(ends(p, true)[0].shape)))})` : '';
    return `${racewayPython(p)}\n_pl_ground_shaft=shaft\n${python(ends(p, !full))}\nshape=_pl_ground_shaft.fuse(components[0])${retentionCuts}\nif not shape.isValid() or not shape.isClosed() or len(shape.Solids)!=1 or shape.Volume<=0: raise ValueError("Precision shaft must be one valid closed solid")\ncomponents=[shape]\ncomponent_labels=["HIWIN ground shaft with ordered custom ends; representative circular raceway"]\ncomponent_colors=[(0.7,0.74,0.77)]\ncomponent_manufactured=[False]\ncomponent_metadata[0].update(${JSON.stringify({ PrecisionOrderRequirement: 'Factory matched HIWIN FDI set; requested C3 ground accuracy/3% preload, factory-approved end drawing and measured lead/runout/preload/backlash certificates are REQUIRED before acceptance. No certificate claimed.', GeometryQualification: 'Source nominalshaft/lead/root and authored end interfaces. Full circular helical groove is representative; OEM Gothic contact/raceway grinding details unpublished. Nut/screw racecontact cannot be certified with this CAD.', EndMachiningDrawing: JSON.stringify(v), ShaftTolerances: 'Bearing seats require maker-approved bearing fit/shoulder radii/runout; end datums are authored source-envelope reconstruction, not a released manufacturing drawing. Retention groovesØ18.6/14.3 selected to externalring standards, order/machining approval required.' })})`;
  },
  dimensions: (p) => {
    const v = precisionScrewLayout(p);
    return [v.overallLength, v.shaftDiameter, v.shaftDiameter];
  },
  notes:
    'Native axisX; active raceway centered0.25×10 ends: fixedØ20×53 with M20×1 first15mm, driveØ20×25, supportedØ20×16/groove12..13.35.20×5: fixedØ15×40/M15×1first12, driveØ15×25, freeØ15×13/groove9..10.15. Model Full raceway is a representative circular profile bound by publishedrootdk/lead, not OEM grinding geometry. Purchase factory-ground matchedFDI set with approved custom ends; C3/3% requirements require actual acceptance certificates.',
  sources: [
    { label: 'HIWIN groundFDI dimensions', url: precisionScrewSource },
    {
      label: 'HIWIN suggested fixed/supported machining pp23/25',
      url: 'https://www.hiwin.com/wp-content/uploads/HIWIN-Ballscrew-Supports-Catalog.pdf',
    },
    {
      label: 'MISUMIJISB2804 externalretaininggroove dimensions',
      url: 'https://sg.misumi-ec.com/pdf/tech/mech/p2855.pdf',
    },
  ],
};
export default part;
