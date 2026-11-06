import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Mesh } from 'three';
import * as mechanical from '../src/core/assembly/mechanical/shapes';
import * as boundary from '../src/core/assembly/boundary/shapes';
import * as electronics from '../src/core/assembly/electronics/shapes';
import * as airframe from '../src/core/assembly/airframe/shapes';
import { arcBand, torus, move } from '../src/core/assembly/mechanical/helpers';
import { detailComponent, parseDetailRecipe } from '../src/core/component-recipes';
import { disposeModel } from '../src/core/mechanical';

const kernels = [mechanical, boundary, electronics, airframe];

test('analytic profile metadata leaves the browser triangle positions unchanged in every shared kernel', () => {
  for (const kernel of kernels) {
    const shape = kernel.roundedRect(20, 12, 2, 3, 5);
    assert.equal(shape.kind, 'prism');
    if (shape.kind !== 'prism') throw new Error('Rounded rectangles retain their preview prism.');
    const annotated = kernel.component(shape, 'Annotated', 0xaaaaaa);
    const sampled = kernel.component({ ...shape, native: undefined }, 'Sampled', 0xaaaaaa);
    const vertices = (group: typeof annotated) => {
      const positions: number[][] = [];
      group.traverse((object) => {
        if (object instanceof Mesh)
          positions.push(Array.from(object.geometry.getAttribute('position').array));
      });
      return positions;
    };
    try {
      assert.ok(vertices(annotated).length > 0);
      assert.deepEqual(vertices(annotated), vertices(sampled));
    } finally {
      disposeModel(annotated);
      disposeModel(sampled);
    }
  }
});

test('fabricated analytic profiles retain their placement and reject contradictory native geometry', () => {
  for (const shape of [
    mechanical.roundedRect(20, 12, 2, 3, 5),
    arcBand(2, 3, 4, 160, 20, 3),
    torus(8, 1.3, 4),
  ]) {
    const placed = move(shape, 30, -12, 8);
    const configured = detailComponent('analytic', 'Analytic detail', placed);
    const recipe = parseDetailRecipe(String(configured.parameters.recipe));
    assert.ok(recipe.kind === 'prism' || recipe.kind === 'revolve');
    if (recipe.kind !== 'prism' && recipe.kind !== 'revolve') continue;
    assert.ok(recipe.native, 'Source analytic metadata survives local reanchoring.');
    assert.deepEqual(recipe, parseDetailRecipe(JSON.stringify(recipe)));
    const incompatible = {
      ...recipe,
      native: {
        ...recipe.native!,
        translation: [
          (recipe.native!.translation?.[0] ?? 0) + 1,
          recipe.native!.translation?.[1] ?? 0,
          recipe.native!.translation?.[2] ?? 0,
        ],
      },
    };
    assert.throws(() => parseDetailRecipe(JSON.stringify(incompatible)), /analytic native profile/);
  }
});

test(
  'native kernels preserve exact volumes, real polygon facets, reversed sectors and placed analytic recipes',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const cases: {
      name: string;
      source: string;
      volume: number;
      dimensions?: number[];
      maxFaces: number;
      cylinders?: number;
      toroidal?: boolean;
    }[] = [];
    for (const [index, kernel] of kernels.entries())
      for (const [width, height, radius] of [
        [20, 12, 2],
        [20, 12, 0],
        [20, 12, 6],
        [12, 12, 6],
      ]) {
        const shape = kernel.roundedRect(width, height, radius, 3, 5);
        if (shape.kind !== 'prism')
          throw new Error('Rounded rectangles retain their preview prism.');
        cases.push({
          name: `kernel-${index}/rounded-${width}-${height}-${radius}`,
          source: kernel.pythonShape(shape),
          volume: (width * height - (4 - Math.PI) * radius ** 2) * 5,
          dimensions: [width, height, 5],
          maxFaces: 10,
          cylinders: radius ? undefined : 0,
        });
      }
    for (const inner of [0, 2])
      for (const [start, end] of [
        [20, 160],
        [160, 20],
        [-150, 150],
        [150, -150],
        [0, 360],
        [360, 0],
        [720, 1080],
      ])
        cases.push({
          name: `sector-${inner}/${start}-${end}`,
          source: mechanical.pythonShape(arcBand(inner, 5 - inner, 4, start, end, 3)),
          volume: (Math.PI * (25 - inner ** 2) * Math.abs(end - start) * 4) / 360,
          maxFaces: 8,
        });
    const ring = torus(8, 1.3, 4);
    cases.push({
      name: 'torus',
      source: mechanical.pythonShape(ring),
      volume: 2 * Math.PI ** 2 * 8 * 1.3 ** 2,
      dimensions: [18.6, 18.6, 2.6],
      maxFaces: 1,
      toroidal: true,
    });
    const hexagon = mechanical.prism(
      Array.from({ length: 6 }, (_, i) => [
        5 * Math.cos((i * Math.PI) / 3),
        5 * Math.sin((i * Math.PI) / 3),
      ]),
      3,
      0,
    );
    cases.push({
      name: 'intentional-hexagonal-prism',
      source: mechanical.pythonShape(hexagon),
      volume: ((3 * Math.sqrt(3)) / 2) * 25 * 3,
      maxFaces: 8,
      cylinders: 0,
    });
    const placements = [
      mechanical.roundedRect(20, 12, 2, 3, 5),
      arcBand(2, 3, 4, 160, 20, 3),
      ring,
    ].map((shape, index) => {
      const source = move(shape, 30, -12, 8),
        configured = detailComponent(`placed-${index}`, 'Placed profile', source);
      return {
        source: boundary.pythonShape(source),
        local: boundary.pythonShape(parseDetailRecipe(String(configured.parameters.recipe))),
        placement: configured.placement,
      };
    });
    const code = `import sys,json,math,os
sys.path.insert(0,os.environ.get('FREECAD_LIB','/Applications/FreeCAD.app/Contents/Resources/lib'))
import FreeCAD as App, Part
def _pl_transform(shape, translation, rotation):
    for axis, angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],rotation):
        if angle: shape.rotate(App.Vector(),axis,angle)
    shape.translate(App.Vector(*translation))
    return shape
cases=json.loads(${JSON.stringify(JSON.stringify(cases))})
for case in cases:
    shape=eval(case['source'])
    assert shape.isValid() and shape.isClosed() and len(shape.Solids)==1 and shape.Volume>0,case['name']
    assert abs(shape.Volume-case['volume'])<max(1e-7,case['volume']*1e-7),(case['name'],shape.Volume,case['volume'])
    assert len(shape.Faces)<=case['maxFaces'],(case['name'],len(shape.Faces))
    if case.get('dimensions'):
        b=shape.optimalBoundingBox(False,False)
        assert max(abs(a-b) for a,b in zip([b.XLength,b.YLength,b.ZLength],case['dimensions']))<1e-5,case['name']
    if 'cylinders' in case:
        assert sum(isinstance(face.Surface,Part.Cylinder) for face in shape.Faces)==case['cylinders'],case['name']
    if case.get('toroidal'):
        assert isinstance(shape.Faces[0].Surface,Part.Toroid),case['name']
placements=json.loads(${JSON.stringify(JSON.stringify(placements))})
for case in placements:
    source=eval(case['source']); local=eval(case['local']); p=case['placement']
    restored=_pl_transform(local,p['translation'],p['rotation'])
    assert source.isValid() and restored.isValid()
    assert abs(source.Volume-restored.Volume)<1e-7
    a,b=source.optimalBoundingBox(False,False),restored.optimalBoundingBox(False,False)
    assert max(abs(getattr(a,key)-getattr(b,key)) for key in ['XMin','YMin','ZMin','XMax','YMax','ZMax'])<1e-5
print(json.dumps({'kernels':len(cases),'placements':len(placements)}))
`;
    const result = spawnSync(process.env.FREECAD_PYTHON!, ['-'], {
      input: code,
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(result.status, 0, `${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      kernels: cases.length,
      placements: placements.length,
    });
  },
);
