import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Group } from 'three';
import { consoleCommand, generateScript } from '../src/core/freecad';
import type { PartDefinition } from '../src/core/types';

const fixture: PartDefinition = {
  id: 'metadata-collision',
  name: 'Metadata collision fixture',
  category: 'Tests',
  subgroup: 'Export',
  description: 'Assembly metadata must not overwrite native properties.',
  keywords: [],
  icon: 'box',
  complexity: 'Test',
  parameters: [],
  defaults: {},
  presets: [],
  validate: () => [],
  buildGeometry: () => new Group(),
  dimensions: () => [4, 2, 3],
  python:
    () => `shape = Part.makeCompound([Part.makeBox(1,2,3), Part.makeBox(1,2,3,App.Vector(3,0,0))])
component_labels = ["First component", "Second component"]
component_metadata = [{"Placement":"Position note", "Shape":"Shape note", "Label":"Label note", "Name":"Name note", "ComponentIndex":"Index note", "AssemblyPlacement":"Assembly note", "Material":"POM-C", "ManufacturingPlacement":"Second position note"}, {}]`,
};

test(
  'native groups retain hierarchy, placements, FCStd and STEP export, and rollback',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const grouped = {
      ...fixture,
      python: () =>
        fixture.python({}, 'default') +
        '\ncomponent_groups = [["Airframe", "Upper"], ["Electronics", "Battery"]]',
    };
    const broken = {
      ...grouped,
      python: () =>
        grouped.python() +
        '\nshape = Part.makeCompound([Part.makeBox(1,2,3),Part.makeLine(App.Vector(3,0,0),App.Vector(4,2,3))])',
    };
    const code = `import FreeCAD as App, Part, Import, tempfile, os
doc = App.newDocument("GroupExportTest")
sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
${consoleCommand(generateScript(grouped, {}, 'default'))}
root = next(o for o in doc.RootObjects if o != sentinel)
airframe, electronics = root.Group
upper = airframe.Group[0]
battery = electronics.Group[0]
first, second = upper.Group[0], battery.Group[0]
assert [o.Label for o in (airframe,upper,electronics,battery)] == ["Airframe","Upper","Electronics","Battery"]
assert first.AssemblyGroup == ["Airframe", "Upper"]
assert first.ComponentIndex == 1 and second.ComponentIndex == 2
original_first = first.getGlobalPlacement().Base
original_second = second.getGlobalPlacement().Base
shift = App.Vector(2,4,6)
airframe.Placement.Base = shift
doc.recompute()
assert (first.getGlobalPlacement().Base-original_first-shift).Length < 1e-9
assert (second.getGlobalPlacement().Base-original_second).Length < 1e-9
airframe.Placement = App.Placement()
root.Placement.Base = shift
doc.recompute()
assert (first.getGlobalPlacement().Base-original_first-shift).Length < 1e-9
assert (second.getGlobalPlacement().Base-original_second-shift).Length < 1e-9
root.Placement = App.Placement()
doc.recompute()
with tempfile.TemporaryDirectory(prefix="protolab-groups-") as directory:
    step = os.path.join(directory,"assembly.step")
    Import.export([root], step)
    restored = Part.read(step)
    assert restored.isValid() and len(restored.Solids) == 2
    assert abs(restored.Volume-12) < 1e-7
    assert abs(restored.BoundBox.XLength-4) < 1e-7
    saved = os.path.join(directory,"assembly.FCStd")
    root_name = root.Name
    doc.saveAs(saved)
    App.closeDocument(doc.Name)
    doc = App.openDocument(saved)
    root = doc.getObject(root_name)
    assert root.Group[0].Group[0].Group[0].AssemblyGroup == ["Airframe", "Upper"]
    assert root.Group[1].Group[0].Group[0].ComponentIndex == 2
    before = set(o.Name for o in doc.Objects)
    try:
        ${consoleCommand(generateScript(broken, {}, 'default'))}
        raise AssertionError("Invalid component accepted")
    except ValueError as error:
        assert "assembly component" in str(error), str(error)
    assert set(o.Name for o in doc.Objects) == before, "Rollback left group objects"
    App.closeDocument(doc.Name)
print("PASS groups, placement, FCStd, STEP and rollback")
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS groups/);
  },
);

test(
  'native export preserves metadata without overwriting FreeCAD or assembly properties',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const command = consoleCommand(generateScript(fixture, {}, 'default'));
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: `import FreeCAD as App
doc = App.newDocument("MetadataExportTest")
sentinel = doc.addObject("App::FeaturePython", "ExistingObject")
for attempt in range(2):
    before = set(o.Name for o in doc.Objects)
    ${command}
    root = next(o for o in doc.RootObjects if o.Name not in before)
    assert root.TypeId == "App::Part" and len(root.Group) == 2
    first, second = root.Group
    # FreeCAD may append a uniqueness suffix on the second import.
    assert first.Label.startswith("First component"), first.Label
    assert first.getTypeIdOfProperty("Placement") == "App::PropertyPlacement"
    assert first.getTypeIdOfProperty("Shape") == "Part::PropertyPartShape"
    assert first.ComponentIndex == 1 and second.ComponentIndex == 2
    assert first.AssemblyPlacement == first.Placement
    assert first.ManufacturingPlacement == "Position note"
    assert first.ManufacturingShape == "Shape note"
    assert first.ManufacturingLabel == "Label note"
    assert first.ManufacturingName == "Name note"
    assert first.ManufacturingComponentIndex == "Index note"
    assert first.ManufacturingAssemblyPlacement == "Assembly note"
    assert first.ManufacturingManufacturingPlacement == "Second position note"
    assert first.Material == "POM-C"
    original = App.Placement(first.Placement)
    sibling_center = second.Shape.CenterOfMass
    placement = App.Placement(first.Placement)
    placement.Base += App.Vector(0,0,10)
    first.Placement = placement
    doc.recompute()
    assert first.AssemblyPlacement == original
    assert (second.Shape.CenterOfMass - sibling_center).Length < 1e-9
assert len(doc.RootObjects) == 3
assert doc.getObject(sentinel.Name) == sentinel
App.closeDocument(doc.Name)
print("PASS metadata, repeated console import and independent placements")
`,
      encoding: 'utf8',
      timeout: 60_000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS metadata/);
  },
);
