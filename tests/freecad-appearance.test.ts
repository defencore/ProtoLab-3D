import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Group } from 'three';
import { freecadAppearancePython } from '../src/core/freecad-appearance';
import { generateScript } from '../src/core/freecad';
import { generateProjectScript } from '../src/core/project-freecad';
import { addProduct, createProject } from '../src/core/design-project';
import type { PartDefinition } from '../src/core/types';

const fixture = (colors: string): PartDefinition => ({
  id: 'appearance-fixture',
  name: 'Appearance fixture',
  category: 'Test',
  subgroup: 'Test',
  icon: 'box',
  keywords: [],
  complexity: 'Test',
  description: 'Purchased unit appearance fixture.',
  product: {
    kind: 'assembly',
    supply: 'purchased',
    description: 'One purchased unit with two visual solids.',
    processes: [],
    releaseRequirements: [],
  },
  parameters: [],
  defaults: {},
  presets: [],
  validate: () => [],
  buildGeometry: () => new Group(),
  dimensions: () => [3, 1, 1],
  python: () =>
    `shape = Part.makeCompound([Part.makeBox(1,1,1),Part.makeBox(1,1,1,App.Vector(2,0,0))])\ncomponent_labels = ["Opaque body","Clear film"]\ncomponent_colors = ${colors}`,
});
function python(source: string, executable = 'python3') {
  const result = spawnSync(executable, ['-'], { input: source, encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test('RGB stays opaque while RGBA validates opacity and creates matching surface appearance', () => {
  const output = python(
    `from types import SimpleNamespace\nclass Material:\n    pass\nApp = SimpleNamespace(Material=Material)\n${freecadAppearancePython}\nview = SimpleNamespace()\n_protolab_apply_color(view, (0.1,0.2,0.3))\nassert view.ShapeAppearance[0].DiffuseColor == (0.1,0.2,0.3,1.0)\nassert view.ShapeAppearance[0].Transparency == 0\n_protolab_apply_color(view, [0.4,0.6,0.8,0.35])\nassert view.ShapeAppearance[0].DiffuseColor == (0.4,0.6,0.8,0.35)\nassert abs(view.ShapeAppearance[0].Transparency-0.65) < 1e-12\nassert view.DisplayMode == "Shaded"\nfor opacity in [0,1]:\n    assert _protolab_color_rgba([0.1,0.2,0.3,opacity])[3] == opacity\nfor invalid in [None,0.5,"red",[],[0,0],[0,0,0,0,0],[-.1,0,0],[0,1.1,0],[0,0,0,-.1],[0,0,0,1.1],[0,0,0,float('nan')],[0,float('inf'),0],[True,0,0],[0,0,0,"0.5"]]:\n    try:\n        _protolab_color_rgba(invalid)\n        raise AssertionError("Invalid color accepted: "+str(invalid))\n    except ValueError:\n        pass\nprint("PASS RGB/RGBA appearance and validation")\n`,
  );
  assert.match(output, /PASS RGB\/RGBA/);
});

test('standalone and project exports validate RGB/RGBA before creating component appearances', () => {
  const part = fixture('[(0.2,0.3,0.4),(0.8,0.9,1.0,0.35)]');
  const standalone = generateScript(part, {}, 'default');
  const project = addProduct(createProject('Appearance'), [part], {
    part,
    parameters: {},
    state: 'default',
  }).project;
  const nested = generateProjectScript(project, [part]);
  assert.match(
    standalone,
    /component_colors = \[_protolab_color_rgba\(color\) for color in component_colors\]/,
  );
  assert.match(nested, /colors = \[_protolab_color_rgba\(color\) for color in colors\]/);
  assert.match(standalone, /\(0.8,0.9,1.0,0.35\)/);
  assert.match(nested, /\(0.8,0.9,1.0,0.35\)/);
});

test(
  'native materials retain opacity and invalid colors roll back headless standalone/project exports',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const valid = fixture('[(0.2,0.3,0.4),(0.8,0.9,1.0,0.35)]');
    const invalid = fixture('[(0.2,0.3,0.4),(0.8,0.9,1.0,1.5)]');
    const projectScript = (part: PartDefinition) =>
      generateProjectScript(
        addProduct(createProject('Appearance'), [part], { part, parameters: {}, state: 'default' })
          .project,
        [part],
      );
    const scripts = [generateScript(valid, {}, 'default'), projectScript(valid)];
    const bad = [generateScript(invalid, {}, 'default'), projectScript(invalid)];
    const output = python(
      `import sys,math,json\nfrom types import SimpleNamespace\nsys.path.insert(0,"/Applications/FreeCAD.app/Contents/Resources/lib")\nimport FreeCAD as App\n${freecadAppearancePython}\nview = SimpleNamespace()\n_protolab_apply_color(view, (0.8,0.9,1.0,0.35))\nmaterial = view.ShapeAppearance[0]\nassert abs(material.Transparency-0.65) < 1e-6\nassert abs(material.DiffuseColor[3]-0.35) < 1e-6\n_protolab_apply_color(view, (0.2,0.3,0.4))\nassert view.ShapeAppearance[0].Transparency == 0\nfor index,script in enumerate(json.loads(${JSON.stringify(JSON.stringify(scripts))})):\n    doc=App.newDocument("AppearanceValid"+str(index))\n    exec(script,{})\n    physical=[o for o in doc.Objects if o.TypeId=="Part::Feature"]\n    assert len(physical)==2\n    assert all(o.Shape.isValid() and o.Shape.Volume>0 for o in physical)\n    App.closeDocument(doc.Name)\nfor index,script in enumerate(json.loads(${JSON.stringify(JSON.stringify(bad))})):\n    doc=App.newDocument("AppearanceInvalid"+str(index))\n    sentinel=doc.addObject("App::FeaturePython","Existing")\n    try:\n        exec(script,{})\n        raise AssertionError("Invalid opacity accepted")\n    except ValueError as error:\n        assert "color" in str(error)\n    assert [o.Name for o in doc.Objects]==[sentinel.Name],"Invalid appearance left partial geometry"\n    App.closeDocument(doc.Name)\nprint("PASS native material and headless RGB/RGBA export validation")\n`,
      process.env.FREECAD_PYTHON!,
    );
    assert.match(output, /PASS native material/);
  },
);
