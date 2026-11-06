import assert from 'node:assert/strict';
import test from 'node:test';
import {Euler,Vector3} from 'three';
import {withGeometryMode} from '../src/core/geometry-mode';
import part,{pieces,channelPieces,framePieces,frameProfiles,mountingPoints,motorFit,libraries} from '../src/parts/tr8-quad-faulhaber-actuator/part';
import old,{channelPieces as oldChannel} from '../src/parts/tr8-quad-twin-pin-mini-actuator/part';
import motor from '../src/parts/faulhaber-bx4/part';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('exact 6855 catalog execution reuses the CAD linked by its product page',()=>{
  const p=motor.presets.find(p=>p.id==='2250s024bx4-6855')!;
  assert.equal(p.name,'2250S024BX4 6855');assert.ok(p.catalog!.sourceUrl.endsWith('/2250S024BX4-6855'));
  assert.deepEqual(motor.validate(p.parameters,'assembled'),[]);
  assert.equal(motor.python(p.parameters,'assembled').match(/STEP SHA-256: (\w+)/)![1],'6b45e62b98198243e0b174761c382a56ced7a54dc219587f902a8f222071f6a8');
  assert.deepEqual(motor.dimensions(p.parameters,'assembled'),motor.dimensions({model:'2250S024BX4'},'assembled'));
});
test('replace only the motor and its mounting fasteners in each approved drive',()=>{
  for(const mode of ['simple','full'] as const)for(const angle of [-20,0,20])withGeometryMode(mode,()=>{
    const now=channelPieces(part.defaults,angle),prior=oldChannel(old.defaults,angle);
    assert.equal(now.length,prior.length);
    for(const piece of now.filter(p=>!p.component.id.startsWith('motor')))assert.deepEqual(piece,prior.find(p=>p.component.id===piece.component.id));
    assert.equal(now.filter(p=>p.component.libraryId==='faulhaber-bx4').length,1);
    assert.ok(now.every(p=>p.component.libraryId!=='gmp16-gearmotor'));
  });
});
test('motor mounting holes follow the supplier coordinate system and remain fixed during motion',()=>{
  const a=channelPieces(part.defaults,-20),b=channelPieces(part.defaults,20);
  assert.deepEqual(a.filter(p=>p.component.id.startsWith('motor')),b.filter(p=>p.component.id.startsWith('motor')));
  const m=a.find(p=>p.component.id==='motor')!.component;
  const e=new Euler(...m.placement.rotation.map(a=>a*Math.PI/180) as [number,number,number],'ZYX');
  const points=mountingPoints();
  [-1,1].forEach((sign,i)=>{
    const p=new Vector3(0,sign*8.5,0).applyEuler(e).add(new Vector3(...m.placement.translation));
    near(p.x,-51);near(p.y,points[i][0]);near(p.z,points[i][1]);
  });
  near(motorFit.boltLength-motorFit.plateThickness,2);assert.ok(motorFit.threadEngagement<motorFit.blindDepth);
  assert.ok(motorFit.shaftEngagement-.3>5&&motorFit.shaftEngagement+.3<7);
});
test('the three new laser discs keep a centre passage and protect their revised openings',()=>{
  for(const pattern of ['lightened','solid'] as const)for(const pilot of [true,false]) {
    const discs=frameProfiles(pilot,pattern).filter(p=>p.id.endsWith('-disc'));
    assert.equal(discs.length,3);
    for(const disc of discs) {
      near(disc.circles[0].radius,28);assert.ok(disc.circles.some(c=>c.radius===2.5&&c.center.every(v=>v===0)));
      for(const [i,c] of disc.circles.slice(1).entries())for(const q of disc.circles.slice(1,i+1))
        assert.ok(Math.hypot(c.center[0]-q.center[0],c.center[1]-q.center[1])-c.radius-q.radius>2.3,'overlapping/weak circular openings');
    }
    const m=discs.find(p=>p.id==='motor-disc')!;
    assert.equal(m.circles.filter(c=>Math.abs(c.radius-(pilot?4.9:5.05))<1e-8).length,4);
    assert.equal(m.circles.filter(c=>c.radius===1.1).length,8);
  }
  assert.equal(framePieces().length,27);
  const front=framePieces().filter(p=>p.component.id.startsWith('frame-front-bolt-'));
  assert.equal(front.length,4);
  for(const p of front) {
    assert.equal(p.component.parameters.head,'countersunk');
    assert.equal(p.component.parameters.length,8);
    const e=new Euler(...p.component.placement.rotation.map(a=>a*Math.PI/180) as [number,number,number],'ZYX');
    const crown=new Vector3(0,0,4).applyEuler(e).add(new Vector3(...p.component.placement.translation));
    near(crown.x,-51);
  }
});
test('new execution validates, retains 115 occurrences and independent output poses',()=>{
  for(const preset of part.presets)assert.deepEqual(part.validate(preset.parameters,'assembled'),[]);
  assert.equal(part.parameters.some(p=>p.key==='motorModel'),false);
  const a=pieces(part.defaults),b=pieces({...part.defaults,angleB:-18});
  assert.equal(a.length,115);assert.equal(a.filter(p=>p.component.libraryId==='faulhaber-bx4').length,4);
  assert.deepEqual(a.filter(p=>!p.component.id.startsWith('b-')),b.filter(p=>!p.component.id.startsWith('b-')));
  const dims=part.dimensions(part.defaults,'assembled');
  dims.forEach((v,i)=>assert.ok(Math.abs(v-[126.8,56,56][i])<1e-5,'Float32 preview bounds match native dimensions'));
  assert.ok(libraries.some(p=>p.id==='faulhaber-bx4'));
});
test('fabrication exports the replacement mounts and exact procurement identities',()=>{
  for(const preset of part.presets) {
    const files=part.fabricationFiles!(preset.parameters);
    assert.equal(new Set(files.map(f=>f.name)).size,files.length);
    assert.ok(files.every(f=>f.name.startsWith('TR8-FAULHABER-6855-56-')));
    const manifest=JSON.parse(files.find(f=>f.id==='cut-manifest')!.content);
    assert.equal(manifest.physicalBlanks,15);assert.equal(manifest.discDiameter,56);
    const schedule=JSON.parse(files.find(f=>f.id==='machining')!.content);
    assert.equal(schedule.motor.threadEngagement,2);assert.equal(schedule.motor.model,'2250S024BX4-6855');
    const bom=files.find(f=>f.id==='bom')!.content;
    assert.equal(bom.split('\n').filter(line=>line.includes('eshop.faulhaber.com/en/2250S024BX4-6855/')).length,4);
    assert.ok(!bom.includes('GMP16T'));
  }
});
