import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, Vector3 } from 'three';
import { spawnSync } from 'node:child_process';
import type { Parameters } from '../src/core/types';
import { consoleCommand, generateScript } from '../src/core/freecad';
import part from '../src/parts/rocket-co2-recovery/part';
import { pieces } from '../src/parts/rocket-co2-recovery/lib/model';
import { groups } from '../src/parts/rocket-co2-recovery/lib/groups';
import { bodyJoints, bodyStructure } from '../src/parts/rocket-co2-recovery/lib/body';
import { finderModules } from '../src/parts/rocket-co2-recovery/lib/finder';
import { geometry, python as assemblyPython } from '../src/parts/rocket-co2-recovery/lib/assembly';
import {
  layout,
  assessment,
  electronicsMountPenetration,
  ties,
} from '../src/parts/rocket-co2-recovery/lib/layout';
import { disposeModel } from '../src/core/mechanical';
import { h7Mounts } from '../src/parts/rocket-co2-recovery/lib/h7-controller';
import { blindTapDimensions } from '../src/parts/rocket-co2-recovery/lib/mechanical';
import { fastener } from '../src/parts/rocket-release/lib/fastener-catalog';
import lch7 from '../src/parts/lch7-controller/part';
import {
  pieces as lch7Pieces,
  h7Spec,
  mountingHoles,
} from '../src/parts/lch7-controller/lib/model';

test('CO2 purchased screws have consistent catalog procurement in every preset export', () => {
  const standards = new Set<string>();
  for (const preset of part.presets) {
    const screws = pieces(preset.parameters, 'assembled').filter(
      (p) => p.shape && fastener(p.shape),
    );
    assert.ok(screws.length > 20);
    const code = assemblyPython(screws);
    const metadataLine = code
      .split('\n')
      .filter((line) => line.startsWith('component_metadata=json.loads('))
      .at(-1)!;
    const metadata = JSON.parse(
      JSON.parse(metadataLine.slice('component_metadata=json.loads('.length, -1)),
    ) as Record<string, string>[];
    assert.equal(metadata.length, screws.length);
    assert.match(code, /component_manufactured=\[False(?:,False)*\]/);
    for (const [i, screw] of screws.entries()) {
      const m = metadata[i];
      assert.equal(m.ManufacturingProcess, 'BUY', screw.label);
      assert.match(
        m.Procurement,
        /^(BUY_STANDARD|BUY_VERIFY_INTERFACE|OEM_INCLUDED)$/,
        screw.label,
      );
      assert.doesNotMatch(m.Standard, /CUSTOM/, screw.label);
      assert.doesNotMatch(m.ProcurementNotes, /Turn to part drawing/, screw.label);
      assert.match(m.SupplierSource, /^https:\/\//, screw.label);
      standards.add(m.Standard);
      if (screw.label.startsWith('BUY body eye bolt'))
        assert.match(m.OrderDesignation, /M8×20.*A4-80/);
      if (screw.label.startsWith('BUY shear screw')) {
        assert.match(m.OrderDesignation, /M2.5×8.*PA66.*MS-M025-0045-CSKP008/);
        assert.match(m.ProcurementNotes, /measure installed shear force/);
      }
    }
  }
  assert.ok([...standards].some((s) => s.includes('DIN 7991')));
  assert.ok([...standards].some((s) => s.includes('ISO 4762')));
  assert.ok([...standards].some((s) => s.includes('DIN 965')));
});

for (const [avionicsLayout, state] of [
  ['wing-2s', 'electronics'],
  ['wing-4s', 'electronics'],
  ['h7-4s', 'electronics'],
  ['wing-4s', 'separated'],
])
  test(
    `CO2 ${avionicsLayout}/${state} complete console export creates independently placed components`,
    { skip: !process.env.FREECAD_PYTHON },
    () => {
      const p = { ...part.defaults, avionicsLayout };
      const command = consoleCommand(generateScript(part, p, state));
      const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input: `import FreeCAD as App
doc = App.newDocument("CO2ConsoleExportTest")
sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
${command}
root = next(o for o in doc.RootObjects if o != sentinel)
assert root.TypeId == "App::Part" and root.PartId == "rocket-co2-recovery"
assert root.ModelState == ${JSON.stringify(state)}
assert len(doc.RootObjects) == 2
def leaves(parent):
    for child in parent.Group:
        if child.TypeId == "App::Part": yield from leaves(child)
        else: yield child
children = sorted(leaves(root), key=lambda o:o.ComponentIndex)
assert len(children) > 30
assert all(o.TypeId == "App::Part" for o in root.Group)
assert len(children) == len(set(o.Name for o in children))
expected_groups = ${JSON.stringify(
          pieces(p, state)
            .filter((x) => x.shape)
            .concat(pieces(p, state).filter((x) => x.library))
            .map((x) => x.group),
        )}
for index, child in enumerate(children):
    assert child.Shape.isValid() and child.Shape.Volume > 0, child.Label
    assert child.ComponentIndex == index + 1
    assert child.getTypeIdOfProperty("Placement") == "App::PropertyPlacement"
    assert child.AssemblyPlacement == child.Placement
    assert child.AssemblyGroup == expected_groups[index], child.Label
    if hasattr(child, "Procurement") and "screw" in child.Label.lower() and child.ManufacturingProcess == "BUY":
        assert child.Procurement in ["BUY_STANDARD", "BUY_VERIFY_INTERFACE", "OEM_INCLUDED"], child.Label
        assert "MAKE" not in child.Label, child.Label
if ${avionicsLayout === 'wing-2s' ? 'False' : 'True'}:
    foundation = next(o for o in children if o.Label.startswith("Battery foundation disk"))
    assert "Raised beyond the dispenser nut" in foundation.ManufacturingPlacement
    assert foundation.getGroupOfProperty("ManufacturingPlacement") == "Manufacturing"
App.closeDocument(doc.Name)
print("PASS complete console export", len(children), "components")
`,
        encoding: 'utf8',
        timeout: 300_000,
      });
      assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /PASS complete console export/);
    },
  );

test('CO2 groups cover every preset and state with separate airframe, fasteners and electronics', () => {
  for (const preset of part.presets)
    for (const state of part.states!) {
      const items = pieces(preset.parameters, state.id);
      assert.ok(items.length);
      for (const item of items) {
        assert.ok(item.group?.length, `${preset.id}/${state.id}: ${item.label}`);
        assert.ok(item.group.every((label) => label.trim().length > 0));
        if (item.library?.kind === 'cell') assert.deepEqual(item.group, groups.battery);
        if (/^BUY (electronics tube|fairing retaining|body structural) screw/.test(item.label))
          assert.deepEqual(item.group, groups.externalScrews);
        if (item.label.startsWith('BUY shear screw'))
          assert.deepEqual(item.group, groups.shearScrews);
        if (item.label.startsWith('Flight-controller') || item.library?.model === 'lch7-v3-2')
          assert.deepEqual(item.group, groups.controller);
      }
      if (state.id === 'assembled') {
        const paths = items.map((item) => JSON.stringify(item.group));
        for (const group of [
          groups.upper,
          groups.lower,
          groups.nose,
          groups.canopy,
          groups.deployment,
          groups.finder,
        ])
          assert.ok(paths.includes(JSON.stringify(group)), `${preset.id}: ${group.join('/')}`);
      }
    }
  const items = pieces(part.defaults, 'finder');
  const python = assemblyPython(items);
  const exported = JSON.parse(
    python
      .split('\n')
      .find((line) => line.startsWith('component_groups='))!
      .split('=')[1],
  );
  assert.deepEqual(
    exported,
    [...items.filter((x) => x.shape), ...items.filter((x) => x.library)].map((x) => x.group),
  );
});

test('H7 4S option retains measured holes, light envelopes and symmetric captured cells', () => {
  const preset = part.presets.find((x) => x.id === 'pem-90-86-16g-h7-4s')!;
  const p = preset.parameters,
    v = layout(p),
    a = pieces(p, 'electronics');
  assert.equal(part.defaults.avionicsLayout, 'wing-2s');
  assert.equal(a.filter((x) => x.library?.kind === 'cell').length, 4);
  assert.ok(!a.some((x) => /F405|WING MINI/.test(x.label)));
  assert.equal(a.filter((x) => x.label.startsWith('Turned spacer')).length, 8);
  assert.equal(a.filter((x) => x.label.startsWith('LCH7 elastomer damper')).length, 4);
  assert.equal(
    a.filter((x) => x.label.startsWith('BUY LCH7 mounting screw') && x.label.includes('M2.5x20'))
      .length,
    4,
  );
  assert.ok(!a.some((x) => /LCH7 nut|LCH7 damper.*insert|LCH7 frame screw/.test(x.label)));
  assert.deepEqual([...new Set(a.map((x) => x.metadata?.ElectricalNode).filter(Boolean))].sort(), [
    'B+',
    'B-',
    'B1',
    'B2',
    'B3',
  ]);
  assert.equal(assessment(p).batteryForce, assessment(part.defaults).batteryForce * 2);
  assert.deepEqual(
    v.cellPositions.reduce(([x, y], [a, b]) => [x + a, y + b], [0, 0]),
    [0, 0],
  );
  const detailed = lch7Pieces();
  assert.ok(detailed.length > 20 && detailed.length < 100);
  assert.ok(JSON.stringify(detailed).length < 100000);
  assert.deepEqual(mountingHoles, [
    [-15.3, -15.3],
    [-15.3, 15.3],
    [15.3, -15.3],
    [15.3, 15.3],
  ]);
  assert.equal(
    a.filter((x) => /lamella|series link/.test(x.label) && x.material === 'Ni200').length,
    3,
  );
  assert.ok(!a.some((x) => /series lead|lead insulation/.test(x.label)));
  assert.ok(a.some((x) => x.library?.model === 'lch7-v3-2'));
  const model = lch7.buildGeometry(lch7.defaults, 'assembled');
  try {
    const size = new Box3().setFromObject(model, true).getSize(new Vector3());
    assert.ok(Math.abs(size.x - h7Spec.envelopeWidth) < 1e-5);
    assert.ok(Math.abs(size.y - 44) < 1e-5);
    assert.ok(Math.abs(size.z - h7Spec.envelopeHeight) < 1e-5);
    let triangles = 0;
    model.traverse((o) => {
      if (o instanceof Mesh)
        triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3;
    });
    assert.ok(triangles < 20000, `H7 envelope must stay lightweight: ${triangles}`);
  } finally {
    disposeModel(model);
  }
});

for (const avionicsLayout of ['h7-4s', 'wing-4s'])
  test(
    `CO2 ${avionicsLayout} native interchangeable carrier and battery clearances`,
    { skip: !process.env.FREECAD_PYTHON },
    () => {
      const p: Parameters = { ...part.defaults, avionicsLayout };
      const all = pieces(p, 'assembled'),
        elec = pieces(p, 'electronics');
      const selected = [
        ...elec,
        ...all.filter((x) =>
          /^(Separating bulkhead|Printed dispenser nut|Nose finder post|Nose finder tray|Nose fairing|Electronics tube)/.test(
            x.label,
          ),
        ),
      ];
      const code = `import FreeCAD as App, Part, math, json\n${assemblyPython(selected)}\n
for s in components: s.rotate(App.Vector(),App.Vector(1,0,0),180)
for i,s in enumerate(components):
 assert s.isValid() and s.isClosed() and s.Volume>0,component_labels[i]
def named(prefix): return components[next(i for i,n in enumerate(component_labels) if n.startswith(prefix))]
bulk=named('Separating bulkhead')
for radius,angles,drill in [(34,[45,135,225,315],2.24),(16.5,[30,90,150,210,270,330],1.22)]:
 for angle in angles:
  a=math.radians(angle);x=radius*math.cos(a);y=radius*math.sin(a)
  # A continuous tapping-drill corridor must reach both faces of the web.
  probe=Part.makeCylinder(drill,7,App.Vector(x,y,-1))
  assert bulk.common(probe).Volume<0.01,('blind threaded hole',angle,radius)
collisions=[]
for i,a in enumerate(components):
 for j in range(i):
  b=components[j]
  if not a.BoundBox.intersect(b.BoundBox): continue
  volume=a.common(b).Volume
  if volume>0.015: collisions.append([component_labels[j],component_labels[i],round(volume,5)])
assert not collisions,json.dumps(collisions,indent=2)
# A straight hex-key corridor reaches each gas-side head without hitting solids.
for x,y in ${JSON.stringify(ties)}:
 tool=Part.makeCylinder(2,140,App.Vector(x,y,9.81))
 for i,s in enumerate(components):
  assert tool.common(s).Volume<.01,('hex-key access',component_labels[i])
# With the four gas-side screws removed and the surrounding tube taken off,
# the captured electronics pack withdraws as one module, away from the nut.
stationary=[named('Separating bulkhead'),named('Printed dispenser nut')]
for i,s in enumerate(components):
 if component_labels[i].startswith(('Separating bulkhead','Printed dispenser nut','Nose fairing','Electronics tube','BUY module mounting')): continue
 for travel in [0.1,1.5,5,20,60]:
  moved=s.copy();moved.translate(App.Vector(0,0,-travel))
  for fixed in stationary:
   if moved.BoundBox.intersect(fixed.BoundBox):
    assert moved.common(fixed).Volume<.01,('module extraction',component_labels[i],travel)
assert len(named('Battery foundation disk').Solids)==1
assert len(named('Battery compression disk').Solids)==1
assert len(named('Flight-controller carrier disk').Solids)==1
for i in range(1,5):
 assert len(named('Cell %d outer insulating seat'%i).Solids)==1
assert len(named('4S supported insulating bridge 1').Solids)==1
assert len(named('4S supported insulating bridge 2').Solids)==1
foundation=named('Battery foundation disk');clamp=named('Battery compression disk')
# Exact surface bounds avoid the control-polygon overshoot of helical B-splines.
def exact_bounds(s): return s.optimalBoundingBox(False,False)
assert abs(exact_bounds(named('Printed dispenser nut')).ZMin-exact_bounds(foundation).ZMax-${+p.dispenserDiskGap})<0.001
# One common carrier-to-clamp interface; both disks can lift off axially.
carrier=named('Flight-controller carrier disk')
for i,(x,y) in enumerate(${JSON.stringify(h7Mounts)}):
 screw=named('BUY controller carrier screw %d'%(i+1))
 probe=Part.makeCylinder(1.01,${layout(p).t + 0.2},App.Vector(x,y,exact_bounds(clamp).ZMin-.1))
 assert clamp.common(probe).Volume<0.005
 assert exact_bounds(screw).ZMax>exact_bounds(clamp).ZMax
 assert exact_bounds(screw).ZMin<exact_bounds(carrier).ZMin
 assert screw.common(carrier).Volume<0.005
 assert screw.common(named('Flight-controller carrier spacer %d'%(i+1))).Volume<0.005
 assert abs(exact_bounds(carrier).ZMax-(exact_bounds(clamp).ZMin-10))<.001
for lift in [1,5,15]:
 moved=carrier.copy();moved.translate(App.Vector(0,0,-lift))
 for prefix in ['Battery compression disk','4S formed B2 lamella','4S B2 lamella backing']:
  assert moved.common(named(prefix)).Volume<.005,prefix
${
  avionicsLayout === 'h7-4s'
    ? `
for i,(x,y) in enumerate(${JSON.stringify(mountingHoles)}):
 screw=named('BUY LCH7 mounting screw %d'%(i+1))
 probe=Part.makeCylinder(1.01,6.2,App.Vector(x,y,exact_bounds(carrier).ZMin-.1))
 assert carrier.common(probe).Volume<.005
 assert screw.common(carrier).Volume<.005
 assert screw.common(named('BUY LCH7 v3.2')).Volume<.005
`
    : `
for prefix in ['BUY WING MINI header pin','BUY WING MINI BAT+','BUY WING MINI GND']:
 for i,label in enumerate(component_labels):
  if label.startswith(prefix):
   assert exact_bounds(components[i]).ZMin-exact_bounds(named('Nose finder tray')).ZMax>10
`
}
for x,y in ${JSON.stringify(layout(p).cellPositions)}:
 for disk in [foundation,clamp]:
  z=exact_bounds(disk).ZMin
  assert disk.common(Part.makeCylinder(9.99,${layout(p).t},App.Vector(x,y,z))).Volume<0.01
  shoulder=Part.makeCylinder(11.45,.1,App.Vector(x,y,z)).cut(Part.makeCylinder(10.1,.1,App.Vector(x,y,z)))
  assert abs(disk.common(shoulder).Volume-shoulder.Volume)<0.01
lamella=named('4S formed B2 lamella')
assert len(lamella.Solids)==1
backing=named('4S B2 lamella backing')
assert len(backing.Solids)==1
print('4S native: valid interchangeable carrier, isolated contacts and clear assembled interfaces')
`;
      const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
        input: code,
        encoding: 'utf8',
        timeout: 300000,
        maxBuffer: 4 * 1024 * 1024,
      });
      assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    },
  );

test('CO2 recovery presets, manufacturing routes and inspection states validate', () => {
  for (const preset of part.presets)
    for (const state of part.states!)
      assert.deepEqual(part.validate(preset.parameters, state.id), []);
  assert.ok(part.validate({ ...part.defaults, pinCount: 2.5 }, 'assembled').length);
  assert.ok(
    part.validate(
      { ...part.defaults, printFemaleAllowance: 0.25, printMaleRelief: 0.2 },
      'assembled',
    ).length,
  );
  assert.ok(part.validate({ ...part.defaults, gasVolume: 3, bayLength: 300 }, 'assembled').length);
  assert.ok(part.validate({ ...part.defaults, packLength: 350 }, 'assembled').length);
});
test('CO2 release clearance affects only the O-ring side, not fixed tube seats', () => {
  for (const avionicsLayout of ['wing-2s', 'wing-4s', 'h7-4s']) {
    for (const aftLayout of ['payload-bay', 'direct-motor']) {
      const narrow = pieces(
        { ...part.defaults, avionicsLayout, aftLayout, releaseFitGap: 0.2 },
        'assembled',
      );
      const wide = pieces(
        { ...part.defaults, avionicsLayout, aftLayout, releaseFitGap: 0.8 },
        'assembled',
      );
      for (const prefix of [
        'Recovery load bulkhead',
        'Rear payload load bulkhead',
        'Nose fairing',
        'Electronics tube',
        '2S insulating cradle',
      ]) {
        const a = narrow.find((piece) => piece.label.startsWith(prefix));
        const b = wide.find((piece) => piece.label.startsWith(prefix));
        assert.deepEqual(
          a,
          b,
          `${avionicsLayout}/${aftLayout}: ${prefix} must not follow release clearance`,
        );
      }
      assert.notDeepEqual(
        narrow.find((piece) => piece.label.startsWith('Separating bulkhead'))?.shape,
        wide.find((piece) => piece.label.startsWith('Separating bulkhead'))?.shape,
      );
    }
  }
});

test(
  'CO2 native fixed D86 seats, rounded parachute exit and O-ring fit retain clear tube and screw interfaces',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = [
      part.defaults,
      {
        ...part.defaults,
        avionicsLayout: 'wing-4s',
        aftLayout: 'direct-motor',
        releaseFitGap: 0.8,
      },
    ];
    const scripts = cases.map((p) => {
      const v = layout(p);
      const selected = pieces(p, 'assembled').filter((piece) =>
        /^(Separating bulkhead|Recovery load bulkhead|Rear payload load bulkhead|Parachute-side spigot seal|Electronics tube|Parachute pressure chamber tube|Payload tube|Direct motor interface tube|Nose fairing|2S insulating cradle|BUY (electronics tube|shear|body structural|fairing retaining) screw)/.test(
          piece.label,
        ),
      );
      return `${assemblyPython(selected)}
for s in components: s.rotate(App.Vector(),App.Vector(1,0,0),180)
def named(prefix): return components[next(i for i,n in enumerate(component_labels) if n.startswith(prefix))]
def section(prefix,z,outer,inner):
 s=named(prefix).common(Part.makeCylinder(50,.2,App.Vector(0,0,z)))
 b=s.optimalBoundingBox(False,False)
 assert abs(b.XLength-outer)<.001 and abs(b.YLength-outer)<.001,(prefix,z,b.XLength,b.YLength)
 # Mid-skirt section is a continuous turned annulus with the specified bore.
 expected=math.pi*((outer/2)**2-(inner/2)**2)*.2
 assert abs(s.Volume-expected)<.001,(prefix,z,s.Volume,expected)
section('Separating bulkhead',-15,86,80)
section('Separating bulkhead',10,${86 - +p.releaseFitGap},${80 - +p.releaseFitGap})
section('Recovery load bulkhead',${v.bodyEnd - (v.directMotor ? 13 : 15)},86,${v.bodySkirtInner * 2})
section('Nose fairing',${-v.electronicsTubeLength + 2},86,82)
${v.directMotor ? `section('Recovery load bulkhead',${v.bodyEnd + 21},86,76)` : `section('Rear payload load bulkhead',${v.rearBulkhead! - 15},86,80)`}
for i,s in enumerate(components):
 assert s.isValid() and s.isClosed() and len(s.Solids)==1,component_labels[i]
 for j,b in enumerate(components[:i]):
  if s.BoundBox.intersect(b.BoundBox):
   assert s.common(b).Volume<.01,(component_labels[i],component_labels[j])
# O-ring envelope and its groove remain on the release side only.
seal=named('Parachute-side spigot seal')
assert seal.BoundBox.ZMin>5 and abs(seal.BoundBox.XLength-86)<.001
tube=named('Parachute pressure chamber tube')
# A real R1 circular blend: test its radial boundary around the entire mouth.
# A flat chamfer or a square-edged bore fails these near-boundary probes.
for depth in [.05,.25,.5,.75,.95,1.05]:
 inner=44-math.sqrt(1-(depth-1)**2) if depth<1 else 43
 for degrees in range(0,360,30):
  angle=math.radians(degrees)
  for offset,inside in [(-.01,False),(.01,True)]:
   point=App.Vector((inner+offset)*math.cos(angle),(inner+offset)*math.sin(angle),5+depth)
   assert tube.isInside(point,.00001,True)==inside,('R1 profile',depth,degrees,offset)
# OD90, tube length, flat end land and full bore beyond the mouth are retained.
bound=tube.optimalBoundingBox(False,False)
assert abs(bound.XLength-90)<.001 and abs(bound.ZLength-${+p.bayLength})<.001
assert tube.isInside(App.Vector(44.5,0,5.001),.00001,True)
section('Parachute pressure chamber tube',7,90,86)
meta=component_metadata[next(i for i,n in enumerate(component_labels) if n.startswith('Parachute pressure chamber tube'))]
assert 'R1' in meta['ParachuteExit'] and 'polish' in meta['EdgeFinish']
# A released nose withdraws from the main tube without a metal interference.
for travel in [1,5,20,25]:
 moving=named('Separating bulkhead').copy();moving.translate(App.Vector(0,0,-travel))
 assert moving.common(named('Parachute pressure chamber tube')).Volume<.01,travel
`;
    });
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: `import FreeCAD as App, Part, math, json\n${scripts.join('\n')}\nprint('FIXED_AND_RELEASE_FITS_OK')`,
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  },
);

test('CO2 source interfaces, separate load paths and library parts are retained', () => {
  const a = pieces(part.defaults, 'assembled');
  assert.equal(a.filter((p) => p.library?.kind === 'cell').length, 2);
  assert.ok(a.some((p) => p.library?.model === 'leland-82122'));
  assert.ok(a.some((p) => p.label.includes('F405 WING-MINI')));
  assert.equal(a.filter((p) => p.label.startsWith('BUY shear screw')).length, 3);
  assert.equal(a.filter((p) => p.label.startsWith('BUY electronics tube screw')).length, 4);
  assert.equal(a.filter((p) => p.label.startsWith('Turned spacer')).length, 8);
  assert.ok(!a.some((p) => p.label.startsWith('Battery foundation disk')));
  assert.equal(a.filter((p) => p.label.startsWith('BUY rounded shoulder eye')).length, 1);
  assert.equal(a.filter((p) => p.label.includes('bonded elastomer damper')).length, 4);
  assert.equal(a.filter((p) => p.label.startsWith('Recovery tie rod')).length, 4);
  assert.equal(a.filter((p) => p.label.startsWith('BUY body structural screw')).length, 24);
  assert.ok(a.some((p) => p.label.startsWith('BUY compact eye nut')));
  assert.ok(
    a.filter((p) => p.label.startsWith('BUY shear screw')).every((p) => p.label.includes('M2.5x8')),
  );
  assert.ok(a.some((p) => p.label.startsWith('ZX908 bare PCB')));
  assert.ok(a.some((p) => p.label.startsWith('JHEMCU JHE20B')));
  const finder = pieces(part.defaults, 'finder');
  assert.ok(finder.some((p) => p.label.startsWith('PWM Switch · 17x13x10')));
  assert.equal(finder.filter((p) => p.label.startsWith('BUY finder cable tie')).length, 6);
  assert.equal(finder.filter((p) => p.label.includes('double-sided mounting tape')).length, 3);
  assert.equal(finder.filter((p) => p.label.includes('heat-shrink sleeve')).length, 3);
  assert.ok(!finder.some((p) => /retaining finger|module screw|silicone/.test(p.label)));
  assert.ok(
    !pieces({ ...part.defaults, finderWrapThickness: 0 }, 'finder').some((p) =>
      p.label.includes('heat-shrink sleeve'),
    ),
  );
  assert.equal(pieces(part.defaults, 'bulkhead').length, 1);
  assert.ok(!pieces(part.defaults, 'mechanisms').some((p) => p.label.includes('tube ·')));
  assert.ok(!pieces(part.defaults, 'separated').some((p) => p.label.startsWith('BUY shear screw')));
  assert.ok(pieces(part.defaults, 'printed-parts').every((p) => p.process === '3D PRINT'));
  const recipe = part.python(part.defaults, 'mechanisms');
  assert.ok(recipe.includes('GasUnitSeat'));
  assert.ok(recipe.includes('ManufacturingProcess'));
  assert.ok(!recipe.includes('/Users/'));
  assert.ok(!recipe.includes('TechDraw'));
  assert.deepEqual(
    a
      .filter((p) => p.metadata?.ElectricalNode)
      .map((p) => p.metadata!.ElectricalNode)
      .sort(),
    ['B+', 'B-', 'B1'],
  );
});
test('CO2 pressure screen uses gauge pressure and measured pin force, with realistic gas units', () => {
  const p = part.defaults,
    a = assessment(p);
  assert.ok(Math.abs(a.area - 5808.8048) < 0.001);
  assert.ok(Math.abs(a.force - 94.80665) < 1e-6);
  assert.ok(a.pressureKPa > 16 && a.pressureKPa < 17);
  assert.ok(a.gasGrams > 0.4 && a.gasGrams < 0.5);
  assert.ok(a.fullChargeKPa > 580 && a.fullChargeKPa < 600);
  assert.ok(a.fullChargeKPa > 30 * a.pressureKPa);
  assert.ok(Math.abs(assessment({ ...p, measuredPinForce: 50 }).force - a.force - 75) < 1e-9);
});
test('CO2 assembly has finite geometry, separated terminals and clear electronics envelopes', () => {
  const p = part.defaults,
    v = layout(p),
    a = pieces(p, 'mechanisms');
  const models = a.map((piece) => geometry([piece]));
  // Public model is nose-up. Inspect local STEP-datum interfaces in their source frame.
  for (const g of models) {
    g.rotateX(Math.PI);
    g.updateMatrixWorld(true);
  }
  const bounds = models.map((g) => new Box3().setFromObject(g, true));
  try {
    for (const [i, g] of models.entries()) {
      let triangles = 0;
      g.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        const pos = o.geometry.getAttribute('position');
        for (const n of pos.array) assert.ok(Number.isFinite(n), a[i].label);
        triangles += (o.geometry.index?.count ?? pos.count) / 3;
      });
      assert.ok(triangles > 0, a[i].label);
      assert.ok(
        bounds[i]
          .getSize(new Vector3())
          .toArray()
          .every((n) => n > 0),
        a[i].label,
      );
    }
    const box = (text: string) => bounds[a.findIndex((p) => p.label.startsWith(text))];
    assert.ok(box('ZX908 bare PCB').max.z < -v.electronicsTubeLength - 20);
    assert.ok(box('JHEMCU JHE20B').max.z < -v.electronicsTubeLength - 20);
    assert.ok(box('PWM Switch ·').max.z < -v.electronicsTubeLength - 20);
    for (const m of finderModules) {
      const size = box(m.label + ' ·').getSize(new Vector3());
      // CSG-tessellated component details carry small Float32 vertex offsets.
      for (const [axis, target] of ['x', 'y', 'z'].map(
        (axis, i) => [axis as 'x' | 'y' | 'z', [m.width, m.depth, m.height][i]] as const,
      ))
        assert.ok(Math.abs(size[axis] - target) < 1e-4, `${m.label} ${axis}: ${size[axis]}`);
    }
    assert.ok(box('BUY compact eye nut').min.z > v.packBottom + +p.packLength + 10);
    assert.ok(Math.abs(box('2S insulating cradle').max.z - v.bulkheadPilotHeight) < 1e-5);
    assert.ok(-box('Battery compression disk').min.z < 74);
    assert.ok(box('Flight-controller carrier disk').max.z < box('Printed dispenser nut').min.z - 4);
    assert.ok(box('BUY WING MINI PWM1').min.z > box('Battery compression disk').max.z + 10);
    assert.ok(box('BUY SpeedyBee F405 WING-MINI · FC').min.x > box('BUY battery 1').max.x);
    assert.ok(box('BUY SpeedyBee F405 WING-MINI · FC').max.x < box('BUY battery 2').min.x);
    assert.ok(Math.abs(box('BUY battery 1').max.z - v.cellTop) < 1e-5);
    assert.ok(Math.abs(box('BUY battery 1').min.z - v.cellBottom) < 1e-5);
    for (const i of [1, 2]) {
      assert.ok(box(`Cell ${i} fixed output`).min.z < v.clampBottom - 1.7);
      assert.ok(
        box(`Cell ${i} outer insulating seat`).min.z < box(`Cell ${i} fixed output`).min.z - 1,
      );
    }
  } finally {
    models.forEach(disposeModel);
  }
});
test(
  'CO2 native solids preserve source fits, captured battery seats and isolated accessible contacts',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const v = layout(part.defaults);
    const code = `import FreeCAD as App, Part, math\n${part.python(part.defaults, 'assembled')}\n
# Public export is nose +Z; rotate back for source-interface probes below.
assert components[next(i for i,s in enumerate(component_labels) if s.startswith('ZX908 bare PCB'))].BoundBox.ZMin > 100
for s in components: s.rotate(App.Vector(),App.Vector(1,0,0),180)
def named(prefix): return components[next(i for i,s in enumerate(component_labels) if s.startswith(prefix))]
for s in components:
 assert s.isValid() and s.isClosed() and s.Volume>0
body=named('Printed dispenser PEM.P3')
nut=named('Printed dispenser nut')
adapter=named('Printed protective adapter')
assert body.common(nut).Volume < 0.01
assert body.common(adapter).Volume < 0.01
seat=Part.makeCylinder(8.74,29.8,App.Vector(0,0,-22.4))
assert body.common(seat).Volume < 0.01
assert body.common(Part.makeCylinder(5.04,9.8,App.Vector(0,0,7.6))).Volume < 0.01
bulk=named('Separating bulkhead')
assert len(bulk.Solids)==1
assert bulk.common(Part.makeCylinder(12.69,5,App.Vector())).Volume<0.01
assert named('Flight-controller carrier disk').common(nut).Volume<0.01
assert named('BUY battery 1').common(named('BUY battery 2')).Volume<0.01
assert adapter.common(named('BUY Leland')).Volume<0.01
for prefix in ['BUY battery 1','BUY battery 2','2S insulating cradle']:
 assert named(prefix).common(nut).Volume<0.01
 assert named(prefix).common(bulk).Volume<0.01
clamp=named('Battery compression disk')
cradle=named('2S insulating cradle')
assert len(cradle.Solids)==1
for i,x in enumerate([-29,29]):
 # Blind locating sockets preserve the gas-side web, while the end disk is open.
 socket=Part.makeCylinder(6.49,1.49,App.Vector(x,0,0))
 assert bulk.common(socket).Volume<0.01
 web=Part.makeCylinder(6.49,3.49,App.Vector(x,0,1.51))
 assert abs(bulk.common(web).Volume-web.Volume)<0.01
 through=Part.makeCylinder(6.49,${v.t},App.Vector(x,0,${v.clampBottom}))
 assert clamp.common(through).Volume<0.01
 shoulder=Part.makeCylinder(11.4,0.1,App.Vector(x,0,${v.clampTop - 0.1})).cut(Part.makeCylinder(6.6,0.1,App.Vector(x,0,${v.clampTop - 0.1})))
 assert abs(clamp.common(shoulder).Volume-shoulder.Volume)<0.01
 cup=named('Cell %d outer insulating seat'%(i+1))
 contact=named('Cell %d fixed output'%(i+1))
 assert len(cup.Solids)==1 and len(contact.Solids)==1
 assert cup.common(clamp).Volume<0.01
 assert cup.common(contact).Volume<0.01
 assert contact.common(clamp).Volume<0.01
 # The entire pilot, terminal and polarity mark can pass through the disk.
 for distance in [0.5,1.5,3,5,8]:
  moved=clamp.copy()
  moved.translate(App.Vector(0,0,-distance))
  assert moved.common(cup).Volume<0.01
  assert moved.common(contact).Volume<0.01
 # Preformed tabs slide into open slots rather than threading through a hole.
 for distance in [0.5,2,4,8,12,16]:
  tab=contact.copy()
  tab.translate(App.Vector((-1 if i==0 else 1)*distance,0,0))
  assert tab.common(cup).Volume<0.01
 # A small axial service probe can reach the output from the exterior face.
 probe=Part.makeBox(1.6,2.8,3,App.Vector(x-0.8,-1.4,${v.outputPadZ - 3}))
 assert probe.common(cup).Volume<0.01
 assert probe.common(clamp).Volume<0.01
 # Nickel conductors are isolated from every metal mounting part.
 for j,label in enumerate(component_labels):
  if label.startswith(('Separating bulkhead','Battery compression disk','Flight-controller carrier disk','Turned spacer','BUY module mounting','BUY end-plate','BUY electronics tube screw')):
   assert components[j].common(contact).Volume<0.01,label
for i,label in enumerate(component_labels):
 if label.startswith('WING MINI frame screw'):
  assert components[i].common(named('Flight-controller carrier disk')).Volume<0.01

# New load path consists of actual through-holes and separate closed hardware.
for prefix in ['Recovery load bulkhead','Rear payload load bulkhead','Harness load-spreading plate','BUY compact eye nut','Nose finder tray']:
 assert len(named(prefix).Solids)==1,prefix
for i in range(1,5):
 rod=named('Recovery tie rod %d'%i)
 for prefix in ['Recovery load bulkhead','Rear payload load bulkhead','Harness load-spreading plate']:
  assert rod.common(named(prefix)).Volume<0.01,prefix
for prefix in ['Recovery load bulkhead','Harness load-spreading plate','BUY body eye bolt']:
 assert named('BUY compact eye nut').common(named(prefix)).Volume<0.01,prefix
for label in ['ZX908 bare PCB','JHEMCU JHE20B','PWM Switch ·']:
 module=named(label)
 for i,name in enumerate(component_labels):
  if name.startswith(('Nose finder','BUY finder')):
   assert module.common(components[i]).Volume<0.01,(label,name)
for i in range(1,7):
 assert named('BUY finder cable tie %d'%i).common(named('Nose finder tray')).Volume<0.01
for i in range(1,5):
 assert named('Nose finder post %d'%i).common(clamp).Volume<0.01
 for j in range(1,5):
  assert named('Recovery tie rod %d'%i).common(named('BUY recovery tie nut %d.%d'%(i,j))).Volume<0.01
for i,label in enumerate(component_labels):
 if label.startswith(('BUY shear screw','BUY body structural screw')):
  for receiver in ['Separating bulkhead','Recovery load bulkhead','Rear payload load bulkhead','Parachute pressure chamber tube','Payload tube']:
   assert components[i].common(named(receiver)).Volume<0.01,(label,receiver)
pack=named('Packed drogue + main')
for travel in [0,100,300,480]:
 moving=pack.copy();moving.translate(App.Vector(0,0,-travel))
 assert moving.common(named('Parachute pressure chamber tube')).Volume<0.01
assert named('Nose fairing').common(named('ZX908 bare PCB')).Volume<0.01
assert named('Nose fairing').common(named('JHEMCU JHE20B')).Volume<0.01
assert named('Nose fairing').common(named('PWM Switch ·')).Volume<0.01
port=Part.makeCylinder(0.74,8,App.Vector(39,0,${-v.electronicsTubeLength + 13}),App.Vector(1,0,0))
assert port.common(named('Nose fairing')).Volume<0.01
assert port.common(named('Electronics tube')).Volume<0.01
print('CO2_NATIVE_OK')
`;
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 360000,
    });
    assert.equal(r.status, 0, String(r.error ?? '') + '\n' + r.stdout + '\n' + r.stderr);
    assert.ok(r.stdout.includes('CO2_NATIVE_OK'));
  },
);

test('CO2 mass and opening loads remain distinct from the nose release calculation', () => {
  const p = part.defaults,
    a = assessment(p);
  assert.equal(p.packDiameter, 80);
  assert.equal(p.packLength, 300);
  assert.equal(a.packRadialClearance, 3);
  assert.ok(Math.abs(a.designHarnessLoad - 3922.66) < 0.01);
  assert.ok(Math.abs(a.tieAxialStressMPa - 48.7893) < 0.001);
  const light = assessment({ ...p, recoveredMass: 8 });
  assert.equal(light.force, a.force);
  assert.ok(Math.abs(light.designHarnessLoad / a.designHarnessLoad - 0.8) < 1e-12);
  assert.ok(part.assessment!(p).some((s) => s.includes('no strength pass')));
});

test(
  'CO2 native finder tray captures three modules with clear leads and fairing',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const p = part.defaults,
      v = layout(p);
    const all = pieces(p, 'assembled');
    const selected = all.filter((item) =>
      /^(Nose finder|BUY finder|ZX908|JHE|PWM Switch|Nose fairing|Battery compression disk)/.test(
        item.label,
      ),
    );
    const code = `import FreeCAD as App, Part, math
${assemblyPython(selected)}
for i,shape in enumerate(components):
 assert shape.isValid() and shape.isClosed() and len(shape.Solids)>0,(component_labels[i],len(shape.Solids))
 if not component_labels[i].startswith(('ZX908 bare PCB','JHEMCU JHE20B','PWM Switch ·')):
  assert len(shape.Solids)==1,(component_labels[i],len(shape.Solids))
 shape.rotate(App.Vector(),App.Vector(1,0,0),180)
def named(prefix): return components[next(i for i,label in enumerate(component_labels) if label.startswith(prefix))]
# Each fixture, device, support pad and fastener is separate and collision-free.
for i,a in enumerate(components):
 for j,b in enumerate(components[:i]):
  aa,bb=a.BoundBox,b.BoundBox
  if aa.XMax<bb.XMin or bb.XMax<aa.XMin or aa.YMax<bb.YMin or bb.YMax<aa.YMin or aa.ZMax<bb.ZMin or bb.ZMax<aa.ZMin: continue
  overlap=a.common(b).Volume
  assert overlap < 0.01, (component_labels[i],component_labels[j],overlap)
tray=named('Nose finder tray')
# Bodies can be installed axially before their cable ties are closed.
for prefix in ['ZX908 bare PCB','JHEMCU JHE20B','PWM Switch ·']:
 for lift in [0,1,3,8,15]:
  moved=named(prefix).copy();moved.translate(App.Vector(0,0,-lift))
  assert moved.common(tray).Volume < 0.01, prefix
# Open side notches accept a 3 mm preattached lead; no closed threading tunnel.
for width,y in [(35,0),(20,21.5),(17,-20.5)]:
 for sign in [-1,1]:
  lead=Part.makeBox(3,2.9,1.4,App.Vector(sign*width/2-(3 if sign<0 else 0),y-1.45,${v.finderTrayZ}-2.5))
  assert lead.common(tray).Volume < 0.01, (width,sign)
for x,y,r in [(26,0,2.9),(-26,0,2.9),(0,13.25,1.7),(18,-22,1.9),(-18,-22,1.9)]:
 probe=Part.makeCylinder(r,2.2,App.Vector(x,y,${v.finderTrayZ}-0.1))
 assert probe.common(tray).Volume < 0.01,(x,y)
# Drilled tie ports have clearance around both vertical legs of all six ties.
for width,depth,y in [(35,20,0),(20,10,21.5),(17,13,-20.5)]:
 for sx in [-1,1]:
  for sy in [-1,1]:
   x=sx*(width/2-4);cy=y+sy*(depth/2+${+p.finderWrapThickness}+0.9)
   probe=Part.makeBox(2.9,1.3,2.2,App.Vector(x-1.45,cy-0.65,${v.finderTrayZ}-0.1))
   assert probe.common(tray).Volume<0.01,(width,sx,sy)
print('FINDER_NATIVE_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      timeout: 180000,
    });
    assert.equal(
      result.status,
      0,
      String(result.error ?? '') + '\n' + result.stdout + '\n' + result.stderr,
    );
    assert.ok(result.stdout.includes('FINDER_NATIVE_OK'));
  },
);

test('CO2 compact motor layout removes the lower bay and adjusts recovered mass once', () => {
  for (const avionicsLayout of ['wing-2s', 'wing-4s', 'h7-4s']) {
    const full = { ...part.defaults, avionicsLayout };
    const p: Parameters = { ...full, aftLayout: 'direct-motor' };
    const a = pieces(p, 'assembled'),
      v = layout(p);
    assert.deepEqual(part.validate(p, 'assembled'), []);
    assert.equal(assessment(p).effectiveRecoveredMass, 9.5);
    assert.ok(
      Math.abs(assessment(p).designHarnessLoad / assessment(full).designHarnessLoad - 0.95) < 1e-12,
    );
    assert.equal(assessment(p).force, assessment(full).force);
    assert.equal(
      a.filter((x) => x.library?.kind === 'cell').length,
      avionicsLayout === 'wing-2s' ? 2 : 4,
    );
    assert.ok(
      !a.some((x) =>
        /^(Payload tube|Computer and camera|Rear payload|Recovery tie rod|BUY recovery tie)/.test(
          x.label,
        ),
      ),
    );
    assert.equal(a.filter((x) => x.label.startsWith('BUY compact backing bolt')).length, 4);
    assert.ok(a.some((x) => x.label.startsWith('Direct motor interface tube')));
    assert.equal(v.rearBulkhead, null);
    assert.equal(layout(full).motorInterfaceZ - v.motorInterfaceZ, 138);
    assert.equal(v.packBottom - 104.5, 10);
    assert.ok(v.bodyEnd - v.packBottom - +p.packLength >= 55);
  }
  assert.equal(
    assessment({ ...part.defaults, aftLayout: 'direct-motor', recoveredMass: 8 })
      .effectiveRecoveredMass,
    7.5,
  );
  assert.ok(part.validate({ ...part.defaults, bayLength: 460 }, 'assembled').length);
});

test('CO2 compact bulkhead staggered holes preserve edge distance and clearance between fixings', () => {
  const p = { ...part.defaults, aftLayout: 'direct-motor' };
  const v = layout(p);
  const joints = bodyJoints(p);
  assert.equal(joints.length, 24);
  for (const joint of joints) {
    const z = joint.z - v.bodyEnd;
    const edges = z < 0 ? [-v.bodySkirtLength, 0] : [8, 8 + v.bodySkirtLength];
    assert.ok(z - edges[0] >= 8 && edges[1] - z >= 8, 'M4 centre must stay 2D from skirt edges');
    const a = (joint.angle * Math.PI) / 180;
    for (const other of joints) {
      if (joint === other) continue;
      const b = (other.angle * Math.PI) / 180;
      const distance = Math.hypot(
        43 * (Math.cos(a) - Math.cos(b)),
        43 * (Math.sin(a) - Math.sin(b)),
        joint.z - other.z,
      );
      assert.ok(distance >= 16, 'Stagger rows to preserve at least 4D M4 centre spacing');
    }
  }
});

test('CO2 manufactured threads report usable depth separately from drilling and relief', () => {
  for (const avionicsLayout of ['wing-2s', 'wing-4s', 'h7-4s']) {
    for (const plateThickness of [2, 3, 4]) {
      const p = { ...part.defaults, avionicsLayout, plateThickness };
      const a = pieces(p, 'assembled');
      const d = blindTapDimensions(4, 8 - plateThickness);
      assert.ok(d.fullDepth > d.penetration);
      assert.ok(d.drillDepth > d.fullDepth + d.tapLead);
      assert.ok(d.totalDepth > d.drillDepth);
      for (const s of a.filter((x) => x.label.startsWith('Turned spacer'))) {
        assert.ok(s.metadata?.BlindThread?.includes('total tip depth'));
        if (s.label.includes('female / female')) {
          assert.ok(s.metadata?.BulkheadThread?.includes('screw penetration 10.20'));
          assert.equal(s.metadata?.MaleThread, undefined);
        } else assert.ok(s.metadata?.MaleThread?.includes('relief neck'));
        assert.ok(parseFloat(s.metadata!.ResidualWeb) >= 2);
      }
      for (const s of a.filter((x) => x.label.startsWith('Nose finder post')))
        assert.ok(parseFloat(s.metadata!.ResidualWeb) >= 2);
    }
  }
});

test(
  'CO2 native blind threads leave tap lead, chip space, drill points and stud relief',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases = [
      { ...part.defaults, avionicsLayout: 'wing-2s', plateThickness: 2 },
      { ...part.defaults, avionicsLayout: 'h7-4s', plateThickness: 3 },
      { ...part.defaults, avionicsLayout: 'wing-2s', plateThickness: 4 },
    ];
    const scripts = cases.map((p) => {
      const v = layout(p),
        hole = blindTapDimensions(4, 8 - v.t);
      const selected = pieces(p, 'assembled').filter((x) =>
        /^(Turned spacer 1\.|BUY module mounting (screw|washer) 1 |BUY end-plate screw 1 |Nose finder post 1 |BUY finder (front|rear) screw 1 )/.test(
          x.label,
        ),
      );
      const carrierTop = v.fourS ? v.foundationTop : v.controllerPlateTop;
      const carrierBottom = carrierTop - v.t;
      const rearHole = blindTapDimensions(3, 8 - v.t),
        frontHole = blindTapDimensions(3, 6);
      return `${assemblyPython(selected)}
for s in components: s.rotate(App.Vector(),App.Vector(1,0,0),180)
def named(prefix): return components[next(i for i,n in enumerate(component_labels) if n.startswith(prefix))]
for i,s in enumerate(components):
 assert s.isValid() and s.isClosed() and len(s.Solids)==1,component_labels[i]
 for j,b in enumerate(components[:i]):
  if s.BoundBox.intersect(b.BoundBox):
   assert s.common(b).Volume<.01,(component_labels[i],component_labels[j])
x=y=34/math.sqrt(2)
for prefix,mouth,shoulder,tip in [('Turned spacer 1.1',${carrierTop},0,4),('Turned spacer 1.2',${v.clampTop},${carrierBottom},${carrierBottom + 8})]:
 s=named(prefix)
 # Drilled cylinder continues beyond the screw and the last complete thread.
 chip=Part.makeCylinder(1.60,${hole.chipSpace - 0.1},App.Vector(x,y,mouth+${hole.fullDepth + hole.tapLead + 0.05}))
 assert s.common(chip).Volume<.001,prefix
 # Drill point stays blind: material remains immediately beyond its tip.
 web=Part.makeCylinder(1,0.2,App.Vector(x,y,mouth+${hole.totalDepth + 0.1}))
 assert abs(s.common(web).Volume-web.Volume)<.001,prefix
 # Only the outer tier has a male end; the service column ends at the web.
 if prefix.endswith('1.1'):
  assert abs(s.optimalBoundingBox(False,False).ZMax)<.001
  continue
 annulus=Part.makeCylinder(1.95,1.2,App.Vector(x,y,shoulder+.1)).cut(Part.makeCylinder(1.56,1.2,App.Vector(x,y,shoulder+.1)))
 assert s.common(annulus).Volume<.001,prefix
service=named('Turned spacer 1.1')
# The service end is blind in -Z, including its own drill point and chip reserve.
service_depth=${blindTapDimensions(4, electronicsMountPenetration).totalDepth}
web=Part.makeCylinder(1,.2,App.Vector(x,y,-service_depth-.1),App.Vector(0,0,-1))
assert abs(service.common(web).Volume-web.Volume)<.001
chip=Part.makeCylinder(1.6,1.3,App.Vector(x,y,-13.05),App.Vector(0,0,-1))
assert service.common(chip).Volume<.001
post=named('Nose finder post 1')
b=post.optimalBoundingBox(False,False);cx=(b.XMin+b.XMax)/2;cy=(b.YMin+b.YMax)/2
for mouth,direction,depth in [(${v.finderTrayZ + 2},1,${frontHole.totalDepth}),(${v.clampBottom},-1,${rearHole.totalDepth})]:
 web=Part.makeCylinder(.8,.2,App.Vector(cx,cy,mouth+direction*(depth+.1)),App.Vector(0,0,direction))
 assert abs(post.common(web).Volume-web.Volume)<.001
`;
    });
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: `import FreeCAD as App, Part, math, json\n${scripts.join('\n')}\nprint('MACHINING_CLEARANCES_OK')`,
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(r.status, 0, String(r.error ?? '') + '\n' + r.stdout + '\n' + r.stderr);
  },
);

test(
  'CO2 compact M8 eye has a clear rope aperture, bearing lands and an accessible through-bolt in both layouts',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const scripts = ['payload-bay', 'direct-motor'].map((aftLayout) => {
      const p = { ...part.defaults, aftLayout },
        v = layout(p);
      const selected = bodyStructure(p).filter((x) =>
        /^(Recovery load bulkhead|Harness load-spreading|BUY compact eye nut|BUY body eye|Body eye seal)/.test(
          x.label,
        ),
      );
      return `${assemblyPython(selected)}
def named(prefix): return components[next(i for i,n in enumerate(component_labels) if n.startswith(prefix))]
for i,s in enumerate(components):
 assert s.isValid() and s.isClosed() and len(s.Solids)==1,component_labels[i]
 for j,b in enumerate(components[:i]):
  assert s.common(b).Volume<.01,(component_labels[i],component_labels[j])
web=named('Recovery load bulkhead'); backing=named('Harness load-spreading')
eye=named('BUY compact eye nut'); bolt=named('BUY body eye bolt')
z=${v.bodyEnd}
b=eye.optimalBoundingBox(False,False)
assert abs(b.XLength-32.6)<.001 and abs(b.YLength-16)<.001 and abs(b.ZLength-33.3)<.001,b
assert abs(b.ZMax-z)<.001,'Eye must seat directly on the bulkhead'
clearance=Part.makeCylinder(4.25,12,App.Vector(0,0,z))
assert clearance.common(web).Volume<.01 and clearance.common(backing).Volume<.01
# Former off-centre U-bolt bores must be filled, not left as pressure leaks.
for x in [-18,18]:
 probe=Part.makeCylinder(4.25,8,App.Vector(x,0,z))
 assert abs(probe.common(web).Volume-probe.Volume)<.001
# The seal is recessed; the foot has a continuous metal bearing land outside D12.
land=Part.makeCylinder(8,.1,App.Vector(0,0,z)).cut(Part.makeCylinder(6,.1,App.Vector(0,0,z)))
assert abs(land.common(web).Volume-land.Volume)<.001
aperture=Part.makeCylinder(10,30,App.Vector(0,-15,z-17),App.Vector(0,1,0))
assert aperture.common(eye).Volume<.001 and aperture.common(bolt).Volume<.001,'D20 rope passage obstructed'
b=bolt.optimalBoundingBox(False,False)
assert abs(b.ZMin-(z-6.4))<.001 and abs(b.ZMax-(z+21.6))<.001,b
assert abs(b.XLength-13)<.001,'ISO 4762 M8 head must be D13'
# Axial hex-key access from the equipment/motor side remains unobstructed.
tool=Part.makeCylinder(3.45,25,App.Vector(0,0,z+21.61))
assert all(tool.common(s).Volume<.001 for s in components)
`;
    });
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: `import FreeCAD as App, Part, math\n${scripts.join('\n')}\nprint('M8_EYE_FITS_OK')`,
      encoding: 'utf8',
      timeout: 120000,
    });
    assert.equal(r.status, 0, `${r.error ?? ''}\n${r.stdout}\n${r.stderr}`);
  },
);

test(
  'CO2 compact native anchor, motor interface and extraction corridor',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const p = { ...part.defaults, aftLayout: 'direct-motor' },
      v = layout(p);
    const selected = pieces(p, 'assembled').filter((x) =>
      /^(Recovery load bulkhead|Harness load-spreading|BUY compact eye nut|Body eye seal|BUY body eye|Compact backing|BUY compact|BUY body structural|Direct motor|Motor-side|Parachute pressure|Packed drogue)/.test(
        x.label,
      ),
    );
    const code = `import FreeCAD as App, Part, math, json\n${assemblyPython(selected)}
for s in components: s.rotate(App.Vector(),App.Vector(1,0,0),180)
def named(prefix): return components[next(i for i,n in enumerate(component_labels) if n.startswith(prefix))]
for i,s in enumerate(components):
 assert s.isValid() and s.isClosed() and s.Volume>0,component_labels[i]
 assert len(s.Solids)==1,(component_labels[i],len(s.Solids))
bulkhead=named('Recovery load bulkhead')
b=bulkhead.optimalBoundingBox(False,False)
assert abs(b.ZLength-60)<.001 and abs(b.XLength-90)<.001,('finished bulkhead envelope',b)
assert abs(b.ZMin-(${v.bodyEnd}-26))<.001 and abs(b.ZMax-(${v.bodyEnd}+34))<.001
# Mid-skirt slices avoid the staggered radial screws and verify open turning bores.
for z in [${v.bodyEnd - 13},${v.bodyEnd + 21}]:
 section=bulkhead.common(Part.makeCylinder(50,.2,App.Vector(0,0,z)))
 assert abs(section.Volume-math.pi*(43**2-38**2)*.2)<.001,('D76 skirt bore',z)
backing=named('Harness load-spreading')
assert abs(backing.optimalBoundingBox(False,False).XLength-74)<.001
# Backing plate and M6 washers clear the thicker collar by at least 1 mm radially.
for i,s in enumerate(components):
 if component_labels[i].startswith(('Harness load-spreading','BUY compact backing washer')):
  clearance_cylinder=Part.makeCylinder(37.001,65,App.Vector(0,0,${v.bodyEnd}-27))
  assert s.cut(clearance_cylinder).Volume<.001,component_labels[i]
collisions=[]
for i,a in enumerate(components):
 for j,b in enumerate(components[:i]):
  if not a.BoundBox.intersect(b.BoundBox): continue
  volume=a.common(b).Volume
  if volume>.015: collisions.append((component_labels[i],component_labels[j],volume))
assert not collisions,json.dumps(collisions,indent=2)
# Measure the motor clearance from the bolt head, not the eye on the parachute face.
anchor_gap=named('Motor-side').optimalBoundingBox(False,False).ZMin-named('BUY body eye bolt').optimalBoundingBox(False,False).ZMax
assert abs(anchor_gap-28.4)<.001,('motor-to-anchor gap',anchor_gap)
# Entire D80 packed chute clears every stationary solid throughout extraction.
pack=named('Packed drogue')
for travel in range(0,481,20):
 moved=pack.copy();moved.translate(App.Vector(0,0,-travel))
 for i,s in enumerate(components):
  if component_labels[i].startswith('Packed drogue'): continue
  if not moved.BoundBox.intersect(s.BoundBox): continue
  assert moved.common(s).Volume<.01,(travel,component_labels[i])
print('COMPACT_NATIVE_OK')
`;
    const r = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 240000,
      maxBuffer: 4 * 1024 * 1024,
    });
    assert.equal(r.status, 0, r.stdout + '\n' + r.stderr);
  },
);

test('F405 and LCH7 4S exchange one carrier without changing the retained battery or nose', () => {
  const wing = { ...part.defaults, avionicsLayout: 'wing-4s' };
  const h7 = { ...part.defaults, avionicsLayout: 'h7-4s' };
  const shared = (p: Parameters) =>
    pieces(p, 'assembled').filter((x) =>
      /^(Separating bulkhead|Battery |Turned spacer|BUY module mounting|BUY end-plate|Cell |4S |BUY B2 |BUY battery|Nose finder|BUY finder|Electronics tube|Nose fairing|Flight-controller carrier spacer|BUY controller carrier)/.test(
        x.label,
      ),
    );
  assert.deepEqual(
    shared(wing),
    shared(h7),
    'Changing controller must preserve battery clamp, lamellas, common mounts and nose geometry',
  );
  for (const plateThickness of [2, 3, 4]) {
    for (const wingPitchX of [16, 18, 20])
      for (const wingPitchY of [20, 22, 24]) {
        const p = { ...wing, plateThickness, wingPitchX, wingPitchY };
        assert.deepEqual(part.validate(p, 'electronics'), []);
        const a = pieces(p, 'electronics');
        assert.equal(a.filter((x) => x.library?.kind === 'cell').length, 4);
        assert.equal(a.filter((x) => x.label.includes('bonded elastomer damper')).length, 4);
        assert.equal(a.filter((x) => x.metadata?.ElectricalNode).length, 5);
        assert.ok(!a.some((x) => x.library?.model === 'lch7-v3-2'));
        const disk = a.find((x) => x.label.startsWith('Flight-controller carrier disk'))!;
        assert.equal(disk.material, 'POM-C');
        assert.equal(disk.process, 'TURN / DRILL');
      }
  }
  assert.equal(assessment(wing).batteryForce, assessment(h7).batteryForce);
  for (const p of [wing, h7]) {
    const publicText = JSON.stringify([
      part.description,
      part.presets,
      part.assessment!(p),
      pieces(p, 'assembled'),
    ]);
    assert.doesNotMatch(publicText, /PART_7|LED_CPU|supplied STEP|STEP-derived|STEP-measured/);
  }
});
