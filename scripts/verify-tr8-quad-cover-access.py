"""Focused support, access and radial release of saved final PETG native solids."""
import json,math,time,sys,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App
import Part
V=App.Vector
out=Path(sys.argv[1] if len(sys.argv)>1 else 'test-results/tr8-quad-geared-rocker-covers-final')
started=time.monotonic();report={'passed':False,'scope':'Two actual PETG configurations per motor; opposite instances are exact half-turn copies. Focused support, tool and radial release checks, not a repeated core/core sweep.','families':[]}
def save(stage):
 report['stage']=stage;report['elapsedSeconds']=time.monotonic()-started;(out/'material-access-native-report.json').write_text(json.dumps(report,indent=2)+'\n');print(stage,flush=True)
def overlap(a,b):
 if any(min(getattr(a.BoundBox,k+'Max'),getattr(b.BoundBox,k+'Max'))-max(getattr(a.BoundBox,k+'Min'),getattr(b.BoundBox,k+'Min'))<1e-8 for k in 'XYZ'):return 0.
 return abs(a.common(b).Volume)
def move(s,v):
 t=s.copy();t.translate(v);return t
def cyl(r,l,p,a):return Part.makeCylinder(r,l,p,a)
def annulus(ri,ro,l,p,a):return cyl(ro,l,p,a).cut(cyl(ri,l,p,a))
def load(folder):
 r=json.loads((folder/'row.json').read_text());s={}
 for f in folder.glob('*.brep'):
  x=Part.Shape();x.read(str(f));s[f.stem]=x
 return r,s
try:
 capture=json.loads((out/'release-capture.json').read_text())
 for path,h in dict(capture['sources'],**capture['preserved']).items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==h, ('Stale source',path)
 report['sources']=capture['sources'];report['releaseCaptureSha256']=hashlib.sha256((out/'release-capture.json').read_bytes()).hexdigest()
 for motor in ['surpass-2838-3700kv','surpass-2845-3100kv']:
  row,s=load(out/'native-shapes'/motor);values=row['values'];R=values['outerRadius'];sections=[s['cover-section-'+str(i+1)] for i in range(4)];old={k:v for k,v in s.items() if not k.startswith('cover-')}
  detail={'motor':motor,'support':[],'tools':[],'removal':[],'envelope':[]};report['families'].append(detail)
  # Exact cylinder-surface distance avoids conservative spline bounds.
  side=next(f for f in cyl(100,200,V(0,0,-100),V(0,0,1)).Faces if type(f.Surface).__name__=='Cylinder')
  for key in [k for k in s if k.startswith('cover-')]:
   radius=100-s[key].distToShape(side)[0];detail['envelope'].append({'id':key,'maximumRadius':radius});assert radius<=R+1e-5,(key,radius,R)
  for station in row['mounts'][:2]:
   name=station['id'][-1];p=V(*station['plateFace']);a=V(*station['axis']);h=V(*station['headFace']);owner=sections[station['coverIndex']];bolt=s['cover-bolt-'+name]
   probe=annulus(1.85,2.85,.25,p+a*.05,a);ratio=overlap(probe,owner)/probe.Volume;assert ratio>.999,('Missing contact-pad annulus',motor,name,ratio)
   # A shifted nominal bolt must meet the entire cone, not an unsupported empty pocket.
   cone_contact=overlap(move(bolt,a*-.06),owner);assert cone_contact>.05,('Unsupported cone',motor,name,cone_contact)
   outer=V(-a.y,a.x,0);up=V(0,0,1);ring=[]
   for direction in [outer,outer*-1,up,up*-1]:
    q=h-a*1+direction*2.35;pr=Part.makeSphere(.05,q);v=overlap(pr,owner);ring.append(v);assert v>pr.Volume*.99,('Cone wall missing',motor,name,q,v)
   detail['support'].append({'mount':name,'fullAnnularPadRatio':ratio,'coneContactAt0_06mmTravel':cone_contact,'fourConeWallProbes':ring,'oneConnectedSolid':len(owner.Solids)==1})
   tool=cyl(2.5,90,h+a*.11,a);hits=[(k,overlap(tool,v)) for k,v in s.items() if not k.startswith('cover-bolt-')];hits=[(k,v) for k,v in hits if v>1e-6];assert not hits,('Cover driver blocked',motor,name,hits);detail['tools'].append({'kind':'cover-driver','mount':name,'radius':2.5,'intersections':hits})
  save(motor+' support and cover-driver passed')
  # Output head/PCD tools: actual four-axis opening, tested on unique +X/+Y placements.
  for axis in [V(1,0,0),V(0,1,0)]:
   perp=V(-axis.y,axis.x,0)
   for offset in [perp*7,perp*-7,V(0,0,7),V(0,0,-7)]:
    tool=cyl(2.5,70,axis*26.1+offset,axis);hits=[(i,overlap(tool,v)) for i,v in enumerate(sections)];hits=[(i,v) for i,v in hits if v>1e-6];assert not hits,('Output-head driver blocked',motor,axis,offset,hits)
  detail['outputHeadToolPassages']=8;detail['outputToolRadius']=2.5
  # Both unique recipes; opposite parts use exactly the same body under Rz180.
  for index in [0,1]:
   axis=[V(1,0,0),V(0,1,0)][index];checks=[]
   fixed={**old,**{'other-cover-'+str(i):v for i,v in enumerate(sections) if i!=index}}
   for d in [.1,.6,1.2,4,12,40,80]:
    moving=move(sections[index],axis*d);hits=[]
    for key,shape in fixed.items():
     vol=overlap(moving,shape)
     if vol>1e-6:hits.append([key,vol])
    checks.append({'offset':d,'collisions':hits})
    if hits:break
   detail['removal'].append({'section':index,'axis':[axis.x,axis.y,axis.z],'stations':checks,'coverBoltsRemoved':True})
   save(motor+' section '+str(index)+(' radial removal blocked' if any(q['collisions'] for q in checks) else ' radial removal passed'))
  detail['completed']=True;save(motor+' access complete')
 report['passed']=all(not q['collisions'] for f in report['families'] for r in f['removal'] for q in r['stations']);save('focused access and radial release passed' if report['passed'] else 'radial release blocked')
 assert report['passed'], 'A radial removal route remains blocked.'
except BaseException as e:
 report['error']=str(e);save('FAILED');raise
