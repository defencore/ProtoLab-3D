import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Group } from 'three';
import { eskdIdentity } from '../src/core/eskd';
import { generateScript } from '../src/core/freecad';
import { detailComponent } from '../src/core/component-recipes';
import type { PartDefinition } from '../src/core/types';
import detail from '../src/parts/manufactured-detail/part';
import { parts } from '../src/parts';
import { addProduct, createProject, validateProject } from '../src/core/design-project';

test('SFK and TR8 projects allow distinct standard fasteners with the same size and reuse motion poses', () => {
  for (const id of ['sfk-rotary-actuator', 'tr8-compact-actuator', 'tr8-quad-actuator']) {
    const part = parts.find((item) => item.id === id)!;
    let project = addProduct(createProject(), parts, {
      part,
      parameters: part.defaults,
      state: 'assembled',
    }).project;
    const moved = { ...part.defaults };
    for (const key of ['outputAngle', 'angleA', 'angleB', 'angleC', 'angleD'])
      if (key in moved) moved[key] = 12;
    project = addProduct(project, parts, {
      part,
      parameters: moved,
      state: 'positive-limit',
    }).project;
    assert.equal(project.configurations.filter((item) => item.libraryId === id).length, 1, id);
    assert.deepEqual(validateProject(project, parts), [], id);
    const m3x8 = project.configurations.filter(
      (item) =>
        item.libraryId === 'bolt-screw' &&
        item.parameters.diameter === 3 &&
        item.parameters.length === 8,
    );
    assert.ok(
      m3x8.some((item) => item.procurement?.standard === 'DIN 912'),
      id,
    );
    assert.ok(
      m3x8.some((item) => item.procurement?.standard === 'ISO 7380-1'),
      id,
    );
  }
});

test(
  'a one-component manufactured assembly retains a separate ESKD detail in standalone FreeCAD',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const component = detailComponent('plate', 'Review plate', {
      kind: 'box',
      size: [10, 8, 2],
      origin: [0, 0, 0],
    });
    const childIdentity = eskdIdentity(detail, component.parameters, 'default', undefined, {
      ...component,
      designation: '',
      revision: 'A',
    });
    const assembly: PartDefinition = {
      ...detail,
      id: 'review-single-component-assembly',
      name: 'Review assembly',
      identityParameters: undefined,
      product: { ...detail.product, kind: 'assembly', processes: ['assembly'] },
      parameters: [],
      defaults: {},
      presets: [],
      validate: () => [],
      buildGeometry: () => new Group(),
      dimensions: () => [10, 8, 2],
      composition: () => ({ components: [component], issues: [] }),
      python: () =>
        [
          'shape = Part.makeBox(10, 8, 2)',
          'component_labels = ["Review plate"]',
          `component_metadata = ${JSON.stringify([{ LibraryId: detail.id, Supply: 'manufactured', ESKDIdentityJSON: JSON.stringify(childIdentity) }])}`,
        ].join('\n'),
    };
    const code = `${generateScript(assembly, {}, 'default')}
root = App.ActiveDocument.RootObjects[0]
assert root.TypeId == 'App::Part', 'A manufactured assembly must retain its assembly container even with one component.'
assert root.ProductType == 'assembly' and root.ProductName == 'Review assembly'
assert len(root.Group) == 1
child = root.Group[0]
assert child.TypeId == 'Part::Feature' and child.ProductType == 'detail'
assert child.Designation == ${JSON.stringify(childIdentity.designation)}
assert child.ProductName == 'Review plate' and child.Designation != root.Designation
print('SINGLE_COMPONENT_ESKD_OK')
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /SINGLE_COMPONENT_ESKD_OK/);
  },
);
