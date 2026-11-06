#!/usr/bin/env python3
"""Render the actual kit geometry in an isolated Blender background process."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/grandado-tube-mount'
MESHES = OUT / 'preview-meshes.json'
BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender'

def prepare():
    OUT.mkdir(parents=True, exist_ok=True)
    js = r'''
import fs from 'node:fs';
import { Mesh, Vector3 } from 'three';
import part from './src/parts/grandado-tube-mount/part.ts';
const output={};
const states=process.env.GRANDADO_PREVIEW_STATES?.split(',')??['assembled','cutaway','template','cassette','exploded','cassette-print','jig-print','cover-only','antenna-underside','cover-underside','gasket-interface'];
for(const state of states) {
  const modelState=state==='antenna-underside'?'assembled':state==='cover-underside'?'cover-only':state==='gasket-interface'?'seal-interface':state;
  const model=part.buildGeometry(part.defaults,modelState); model.updateMatrixWorld(true);
  const meshes=[];
  model.traverse(object=>{
    if(!(object instanceof Mesh))return;
    const positions=object.geometry.getAttribute('position'), index=object.geometry.getIndex();
    const point=new Vector3(), vertices=[], faces=[];
    for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(object.matrixWorld);vertices.push(point.toArray());}
    for(let i=0;i<(index?.count??positions.count);i+=3)faces.push([0,1,2].map(j=>index?index.getX(i+j):i+j));
    const material=Array.isArray(object.material)?object.material[0]:object.material;
    meshes.push({label:object.name,vertices,faces,color:material.color?.toArray()??[.5,.5,.5]});
  });
  output[state]=meshes;
}
fs.writeFileSync('test-results/grandado-tube-mount/preview-meshes.json',JSON.stringify(output));
'''
    subprocess.run(['node','--import','tsx','--input-type=module','-e',js],cwd=ROOT,check=True)
    paths=sorted((ROOT/'src/parts/grandado-tube-mount').rglob('*.ts'))
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
    (OUT/'preview-source-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')

def render():
    import bpy
    from mathutils import Vector
    data=json.loads(MESHES.read_text())
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=8 if '--quick' in sys.argv else 24
    scene.cycles.use_denoising=True
    scene.render.resolution_x=1500
    scene.render.resolution_y=1100
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.world.color=(0.18,0.18,0.18)
    scene.view_settings.view_transform='AgX'
    def aim(obj,point): obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,energy,size in [('Key',(0.15,-0.18,.35),2,.28),('Fill',(-.15,.12,.22),1,.25),('Rim',(.1,.25,.15),.6,.2),('Underside',(.12,-.12,-.30),2.5,.28),('Lower fill',(-.15,.10,-.20),.8,.25)]:
        light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size
        ob=bpy.data.objects.new(name,light);scene.collection.objects.link(ob);ob.location=loc;aim(ob,(0,0,0))
    camera=bpy.data.cameras.new('Camera');ob=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(ob);scene.camera=ob;camera.type='ORTHO'
    outputs=[]
    for state,meshes in data.items():
        for old in [o for o in scene.objects if o.type=='MESH']: bpy.data.objects.remove(old,do_unlink=True)
        positions=[]
        for i,item in enumerate(meshes):
            verts=[tuple(n*.001 for n in v) for v in item['vertices']];positions.extend(verts)
            mesh=bpy.data.meshes.new(f'{state}-{i}');mesh.from_pydata(verts,[],item['faces']);mesh.update()
            obj=bpy.data.objects.new(item['label'] or f'part-{i}',mesh);scene.collection.objects.link(obj)
            mat=bpy.data.materials.new(f'{state}-material-{i}');mat.diffuse_color=(*item['color'],1);mat.use_nodes=True
            shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=mat.diffuse_color;shader.inputs['Roughness'].default_value=.55
            obj.data.materials.append(mat)
        low=Vector(tuple(min(p[i] for p in positions) for i in range(3))); high=Vector(tuple(max(p[i] for p in positions) for i in range(3))); centre=(low+high)*.5
        direction=Vector((.23,-.27,-.20 if state in ('antenna-underside','cover-underside','gasket-interface') else .20))
        ob.location=centre+direction;aim(ob,centre)
        right=ob.rotation_euler.to_quaternion()@Vector((1,0,0))
        up=ob.rotation_euler.to_quaternion()@Vector((0,1,0))
        px=[(Vector(p)-centre).dot(right) for p in positions]
        py=[(Vector(p)-centre).dot(up) for p in positions]
        centre+=right*((min(px)+max(px))*.5)+up*((min(py)+max(py))*.5)
        ob.location=centre+direction;aim(ob,centre)
        camera.ortho_scale=max(max(px)-min(px),(max(py)-min(py))*scene.render.resolution_x/scene.render.resolution_y)*1.16
        path=OUT/f'{state}.png';scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);outputs.append(path.name)
    hashes=json.loads((OUT/'preview-source-hashes.json').read_text())
    (OUT/'render-report.json').write_text(json.dumps({'source':'Actual Three.js kit geometry; no geometry changes for rendering','sourceHashes':hashes,'outputs':outputs},indent=2)+'\n')

if '--inside-blender' in sys.argv:
    render()
else:
    prepare()
    if '--prepare-only' in sys.argv:
        sys.exit(0)
    subprocess.run([BLENDER,'--background','--factory-startup','--python',str(Path(__file__).resolve()),'--','--inside-blender',*(['--quick'] if '--quick' in sys.argv else [])],cwd=ROOT,check=True)
