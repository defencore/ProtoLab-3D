import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import frame, { frameManufacturing } from '../src/parts/cnc-frame-part/part';
import { millingLayout } from '../src/parts/cnc-milling-machine/lib/layout';
import { withGeometryMode } from '../src/core/geometry-mode';
import type { Parameters } from '../src/core/types';
import mill, { millingComponents } from '../src/parts/cnc-milling-machine/part';
import { millingLibraries } from '../src/parts/cnc-milling-machine/lib/composition';
import { componentPython } from '../src/core/assembly/detail-instances';

const settings = {
  spindle: 'jst-2200-water-80',
  tableHeight: 800,
  toolProjection: 25,
  xPosition: 50,
  yPosition: 50,
  zPosition: 50,
};
const v = millingLayout(settings);
const fixed: Parameters = {
  ...frame.defaults,
  role: 'z-fixed-box',
  stockGrade: v.aluminiumGrade,
  sizeX: v.fixedPlateWidth,
  sizeY: v.fixedPlateThickness,
  sizeZ: v.fixedPlateHeight,
  ribThickness: v.fixedRibThickness,
  ribDepth: v.fixedRibDepth,
  ribCenterX: v.fixedRibCenterX,
  internalFillet: 5,
  holes: '[]',
};
const moving: Parameters = {
  ...frame.defaults,
  role: 'z-moving-box',
  stockGrade: v.aluminiumGrade,
  sizeX: v.movingPlateWidth,
  sizeY: v.movingPlateThickness,
  sizeZ: v.movingPlateHeight,
  ribThickness: v.movingRibThickness,
  ribDepth: v.movingRibDepth,
  ribCenterX: v.movingRibCenterX,
  internalFillet: 5,
  bossWidth: v.zNutCarrierWidth,
  bossDepth: v.zNutCarrierDepth,
  bossThickness: v.zNutCarrierThickness,
  bossCenterX: v.zNutPlatformCenterX,
  bossCenterY: v.zNutPlatformCenterY - (v.zPlateBack + v.zPlateFront) / 2,
  bossCenterZ:
    v.guideLow + 100 + v.zNutPlatformBottomFromGuide + v.zNutCarrierThickness / 2 - v.saddleCenter,
  centralDrivePocket: JSON.stringify({
    axisY: v.zScrewY - (v.zPlateBack + v.zPlateFront) / 2,
    shaftDiameter: 20.1,
    nutDiameter: 34.05,
    nutBottomZ: v.guideLow + 100 + v.zNutPlatformBottomFromGuide - v.saddleCenter,
    nutHeight: 67,
    flangeDiameter: 57.1,
    flangeBottomZ: v.guideLow + 100 + v.zNutPlatformBottomFromGuide - 12 - v.saddleCenter,
    flangeHeight: 12,
    rearWidth: v.zRearChannelWidth,
    rearDepth: v.zRearChannelDepth,
    rearHeight: v.zRearChannelTop - v.movingPlateBottom,
    rootRadius: 5,
  }),
  holes: '[]',
};

test('integral U blanks retain the complete web, ribs and real machining stock', () => {
  for (const p of [fixed, moving]) {
    assert.deepEqual(frame.validate(p, 'default'), []);
    assert.match(frameManufacturing(p).blank, /^Single machined billet/);
    assert.ok(frameManufacturing(p).requirements.some((line) => line.includes('ONE billet')));
  }
  assert.match(
    frameManufacturing(fixed).blank,
    new RegExp(`${v.fixedPlateWidth} x 100 x ${v.fixedPlateHeight} mm`),
  );
  assert.match(
    frameManufacturing(moving).blank,
    new RegExp(`${v.movingPlateWidth} x 136 x ${v.movingPlateHeight} mm`),
  );
  assert.ok(frame.validate({ ...moving, bossCenterY: 1000 }, 'default').length > 0);
  assert.ok(frame.validate({ ...moving, bossCenterX: 1000 }, 'default').length > 0);
  const pocket = JSON.parse(String(moving.centralDrivePocket));
  assert.ok(
    frame.validate(
      { ...moving, centralDrivePocket: JSON.stringify({ ...pocket, axisY: 1000 }) },
      'default',
    ).length,
  );
  assert.ok(
    frame.validate(
      { ...moving, centralDrivePocket: JSON.stringify({ ...pocket, nutDiameter: 89 }) },
      'default',
    ).length,
  );
  assert.ok(frame.validate({ ...fixed, ribCenterX: 255 }, 'default').length > 0);
});

test('external corner relief and a single-leg L bracket use explicit stock rules', () => {
  const p = {
    ...frame.defaults,
    role: 'nut-bracket',
    sizeX: 20,
    sizeY: 90,
    sizeZ: 120,
    holes: '[]',
    cornerReliefRadius: 23.5,
  };
  assert.deepEqual(frame.validate(p, 'default'), []);
  assert.ok(frameManufacturing(p).requirements.some((line) => line.includes('R23.5')));
  assert.ok(frame.validate({ ...p, role: 'foot-plate' }, 'default').length);
  assert.ok(frame.validate({ ...p, cornerReliefRadius: 45 }, 'default').length);
  assert.ok(
    frame.validate(
      {
        ...p,
        holes: JSON.stringify([{ axis: 'x', at: [-10.1, 45, 60], diameter: 47, depth: 20.2 }]),
      },
      'default',
    ).length,
    'generic open-edge bores remain invalid',
  );
  const leg = {
    ...frame.defaults,
    role: 'limit-angle',
    sizeX: 13.5,
    sizeY: 30,
    sizeZ: 25,
    wall: 8,
    holes: '[]',
  };
  assert.deepEqual(frame.validate(leg, 'default'), []);
  assert.ok(frame.validate({ ...leg, sizeX: 8 }, 'default').length);
});

test('complete travel and source block-end clearance survive the reinforced portal geometry', () => {
  assert.deepEqual([v.workX, v.workY, v.workZ], [800, 1500, 200]);
  assert.ok(v.workY / 2 + v.blockSpacingY / 2 + 77.5 / 2 < v.railYLength / 2);
  assert.ok(v.guideLow - v.blockSpacingZ / 2 - 77.5 / 2 > v.railZCenter - v.railZLength / 2);
  assert.ok(v.sideInnerX - 650 - 28.25 > 0, 'actual Y scale depth clears the moving side');
  assert.equal(v.sideInnerX * 2, v.beamWidth);
  assert.equal(v.sideInnerX * 2, v.tiebarWidth);
  assert.equal(v.footPlateCenterX + v.footPlateWidth / 2, 727.5);
  assert.equal(v.driveLinkCenterX - v.driveLinkThickness / 2, v.sideInnerX);
  assert.ok(v.portalPostCenterX - v.portalPostWidth / 2 > v.workX / 2 + v.fixedPlateWidth / 2);
  assert.equal(v.xPlateBack, v.beamFrontDatum + 30);
  assert.equal(v.zPlateBack, v.xPlateFront + 30);
  assert.equal(v.zScrewY, 178);
  assert.equal(v.zScrewX, 0);
  assert.equal(v.movingPlateTop, v.tableTop + 545);
  assert.equal(v.movingPlateThickness - v.zRearChannelDepth, 6);
  assert.ok(Math.abs(v.bedCompositeI - 129078421.05263159) < 1e-5);
});

test(
  'native integral U parts and rounded tube/insert interfaces remain closed and clear',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const scripts = ['import FreeCAD as App, Part, math, json\nrows=[]\nshapes={}'];
    const configs: [string, Parameters][] = [
      ['fixed', fixed],
      ['moving', moving],
      [
        'rib',
        {
          ...frame.defaults,
          role: 'table-rib-tube',
          material: 'steel',
          stockGrade: v.steelGrade,
          sizeX: v.tableRibSpan,
          sizeY: v.tableRibWidth,
          sizeZ: v.tableRibHeight,
          wall: v.tableRibWall,
          tubeAxis: 'x',
          cornerRadius: v.tableRibCornerRadius,
          holes: '[]',
        },
      ],
      [
        'insert',
        {
          ...frame.defaults,
          role: 'section-insert',
          material: 'steel',
          stockGrade: v.steelGrade,
          sizeX: 40,
          sizeY: 83.8,
          sizeZ: 83.8,
          tubeAxis: 'x',
          cornerRadius: 12.2,
          holes: '[]',
        },
      ],
      [
        'beam',
        {
          ...frame.defaults,
          role: 'gantry-beam',
          material: 'steel',
          stockGrade: v.steelGrade,
          sizeX: v.beamWidth,
          sizeY: v.beamDepth,
          sizeZ: v.beamHeight,
          wall: v.beamWall,
          tubeAxis: 'x',
          cornerRadius: v.beamCornerRadius,
          frontDatumTrim: v.beamDepth / 2 - v.beamFrontDatum,
          holes: '[]',
        },
      ],
      [
        'bed',
        {
          ...frame.defaults,
          role: 'bed-member',
          material: 'steel',
          stockGrade: v.steelGrade,
          sizeX: v.bedWidth,
          sizeY: v.bedLength,
          sizeZ: v.bedTubeDepth,
          wall: v.bedWall,
          tubeAxis: 'y',
          cornerRadius: v.bedCornerRadius,
          holes: '[]',
        },
      ],
    ];
    for (const [id, p] of configs) {
      assert.deepEqual(frame.validate(p, 'default'), [], id);
      scripts.push(withGeometryMode('simple', () => frame.python(p, 'default')));
      scripts.push(
        `assert len(shape.Solids)==1 and shape.isValid() and shape.isClosed() and math.isfinite(shape.Volume) and shape.Volume>0, ${JSON.stringify(id)}\nshapes[${JSON.stringify(id)}]=shape.copy()\nrows.append({'id':${JSON.stringify(id)},'volume':shape.Volume,'bounds':[shape.BoundBox.XLength,shape.BoundBox.YLength,shape.BoundBox.ZLength]})`,
      );
    }
    const beamParameters = configs.find(([id]) => id === 'beam')![1];
    const threadedBeam = {
      ...beamParameters,
      threadFitAllowance: 0.05,
      holes: JSON.stringify(
        [-70, 70].map((z) => ({
          axis: 'y',
          at: [0, v.beamFrontDatum - 10, z],
          diameter: 5,
          depth: 10,
          threadPitch: 0.8,
          threadDesignation: 'M5',
        })),
      ),
    };
    for (const mode of ['simple', 'full'] as const) {
      scripts.push(withGeometryMode(mode, () => frame.python(threadedBeam, 'default')));
      scripts.push(
        `assert len(shape.Solids)==1 and shape.isValid() and shape.isClosed() and math.isfinite(shape.Volume) and shape.Volume>0, ${JSON.stringify('beam-through-tap/')}+${JSON.stringify(mode)}\nfor z in [-70,70]:\n    witness=App.Vector(0,86.7,z)\n    assert shapes['beam'].isInside(witness,1e-7,True), ('actual wall witness',z)\n    assert not shape.isInside(witness,1e-7,True), ('tap floor remains',z)\nrows.append({'id':${JSON.stringify('beam-through-tap/')}+${JSON.stringify(mode)},'volume':shape.Volume})`,
      );
    }
    scripts.push(
      `insert=shapes['insert'].copy()\ninsert.translate(App.Vector(${v.tableRibSpan / 2 - 20},0,0))\nc=insert.common(shapes['rib'])\nassert math.isfinite(c.Volume) and abs(c.Volume)<1e-6, ('rounded rib insert',c.Volume)`,
    );
    scripts.push(
      `fixed=shapes['fixed'].copy()\nfixed.translate(App.Vector(0,${(v.xPlateBack + v.xPlateFront) / 2},${v.fixedPlateCenter}))\nfor z in [0,100,200]:\n    moving=shapes['moving'].copy()\n    moving.translate(App.Vector(0,${(v.zPlateBack + v.zPlateFront) / 2},${v.saddleCenter - 100}+z))\n    c=fixed.common(moving)\n    assert math.isfinite(c.Volume) and abs(c.Volume)<1e-6, ('U section clearance',z,c.Volume)`,
    );
    const output = '/tmp/protolab-cnc-structure-native.json';
    scripts.push(
      `open(${JSON.stringify(output)},'w').write(json.dumps(rows,indent=2,allow_nan=False))`,
    );
    const source = scripts.join('\n'),
      path = '/tmp/protolab-cnc-structure-native.py';
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 180000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    const records = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(records.length, configs.length + 2);
    writeFileSync(
      '/tmp/protolab-cnc-structure-native-proof.json',
      JSON.stringify(
        {
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          records,
          scope:
            'Six actual authored blank configurations plus two Simple/Full beam-wall tap checks; native single-solid closure, rounded rib insert and three U-section poses. Excludes final drive mounting holes and assembly qualification.',
        },
        null,
        2,
      ),
    );
  },
);

test(
  'compact installed Z blanks retain actual stock and machined skin for every spindle and tool gauge',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const scripts = ['import FreeCAD as App, Part, math, json\nrows=[]'];
    const variants: { spindle: string; toolProjection: number; parameters: Parameters }[] = [];
    for (const spindle of [
      'jst-1500-water-65',
      'jst-2200-water-80',
      'jst-2200-air-80',
      'jst-3000-water-100',
      'zhj-3000-air-100',
    ])
      for (const toolProjection of [20, 25, 50]) {
        const p = { ...mill.defaults, spindle, toolProjection },
          layout = millingLayout(p),
          instance = millingComponents(p).find(
            (piece) => piece.component.id === 'moving-z-saddle',
          )!;
        assert.deepEqual(frame.validate(instance.component.parameters, 'default'), []);
        assert.equal(instance.component.parameters.sizeY, 30);
        assert.equal(layout.movingPlateTop, layout.tableTop + 590);
        const pocket = JSON.parse(String(instance.component.parameters.centralDrivePocket));
        assert.equal(pocket.axisY + instance.component.placement!.translation[1], 178);
        assert.equal(pocket.rearDepth, 24);
        assert.equal(pocket.rearWidth, 80);
        variants.push({ spindle, toolProjection, parameters: instance.component.parameters });
        scripts.push(
          withGeometryMode('simple', () => frame.python(instance.component.parameters, 'default')),
        );
        // The actual machined rear channel must leave the configured six millimetre front skin.
        // Test low channel stock away from all source bolt bores, not a surrogate section.
        const channelZ = -layout.movingPlateHeight / 2 + pocket.rearHeight / 2;
        scripts.push(
          `assert len(shape.Solids)==1 and shape.isValid() and shape.isClosed() and math.isfinite(shape.Volume) and shape.Volume>0, ${JSON.stringify(spindle + '/' + toolProjection)}\n` +
            `assert shape.isInside(App.Vector(0,13,${channelZ}),1e-7,False), 'front skin removed'\n` +
            `assert not shape.isInside(App.Vector(0,0,${channelZ}),1e-7,False), 'rear support channel absent'\n` +
            `bounds=shape.optimalBoundingBox(False,False)\nassert abs(bounds.ZLength-${layout.movingPlateHeight})<1e-5, 'actual machined height'\n` +
            `rows.append({'spindle':${JSON.stringify(spindle)},'toolProjection':${toolProjection},'volume':shape.Volume,'height':bounds.ZLength,'frontSkin':6})`,
        );
      }
    const output = '/tmp/protolab-cnc-compact-z-native.json',
      path = '/tmp/protolab-cnc-compact-z-native.py';
    scripts.push(
      `open(${JSON.stringify(output)},'w').write(json.dumps(rows,indent=2,allow_nan=False))`,
    );
    const source = scripts.join('\n');
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 180000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    const records = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(records.length, 15);
    writeFileSync(
      '/tmp/protolab-cnc-compact-z-native-proof.json',
      JSON.stringify(
        {
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          variants,
          records,
          scope:
            'Fifteen actual installed moving-Z fabricated configurations: five spindles at tool projections20/25/50mm. Native one-solid validity/closure/positive finite volume, actual machined height and six-millimetre front-skin witnesses. Does not establish complete-machine collisions, stiffness or machining accuracy.',
        },
        null,
        2,
      ),
    );
  },
);

test(
  'actual central Z nut and bearing supports clear the machined saddle in both modes at all named Z poses',
  { skip: !process.env.FREECAD_PYTHON },
  () => {
    const ids = ['moving-z-saddle', 'z-ball-nut', 'z-bk15', 'z-bf15'],
      picked = millingComponents(mill.defaults).filter((piece) => ids.includes(piece.component.id)),
      scripts = ['import FreeCAD as App, Part, math, json\nrows=[]'];
    assert.deepEqual(picked.map((piece) => piece.component.id).sort(), [...ids].sort());
    for (const mode of ['simple', 'full'] as const) {
      scripts.push(withGeometryMode(mode, () => componentPython(millingLibraries, picked)));
      scripts.push(
        `base={key:child.copy() for key,child in zip(${JSON.stringify(picked.map((piece) => piece.component.id))},components)}\n` +
          `for key,child in base.items():\n    assert not child.isNull() and child.isValid() and child.isClosed() and math.isfinite(child.Volume) and child.Volume>0,(key,'invalid source')\n` +
          `for z in [0,100,200]:\n    saddle=base['moving-z-saddle'].copy()\n    saddle.translate(App.Vector(0,0,z-100))\n` +
          `    for key in ['z-ball-nut','z-bk15','z-bf15']:\n        child=base[key].copy()\n        if key=='z-ball-nut': child.translate(App.Vector(0,0,z-100))\n` +
          `        common=saddle.common(child)\n        volume=common.Volume\n        assert math.isfinite(volume) and abs(volume)<1e-6,(${JSON.stringify(mode)},z,key,volume)\n` +
          `        if not common.isNull() and common.Solids: assert common.isValid() and common.isClosed(),('invalid Common',key)\n` +
          `        rows.append({'mode':${JSON.stringify(mode)},'z':z,'sourceA':'moving-z-saddle','sourceB':key,'volume':volume})`,
      );
    }
    const output = '/tmp/protolab-cnc-compact-pocket-native.json',
      path = '/tmp/protolab-cnc-compact-pocket-native.py';
    scripts.push(
      `open(${JSON.stringify(output)},'w').write(json.dumps({'passed':True,'cases':rows},indent=2,allow_nan=False))`,
    );
    const source = scripts.join('\n');
    writeFileSync(path, source);
    const result = spawnSync(process.env.FREECAD_PYTHON!, [path], {
      encoding: 'utf8',
      env: process.env,
      timeout: 180000,
    });
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    const records = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(records.cases.length, 18);
    writeFileSync(
      '/tmp/protolab-cnc-compact-pocket-native-manifest.json',
      JSON.stringify(
        {
          sourceSha256: createHash('sha256').update(source).digest('hex'),
          rootConfiguration: mill.defaults,
          pieces: picked,
          scope:
            'Actual installed nut/BK15/BF15 against the configured moving saddle at Z0/100/200 in Simple and Full, strict finite common volume<1e-6mm3. Excludes shaft and complete-machine qualification.',
        },
        null,
        2,
      ),
    );
  },
);
