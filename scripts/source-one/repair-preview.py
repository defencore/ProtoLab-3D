"""Repair known OCC preview omissions; native upstream BRep is never modified."""
from pathlib import Path
import json, struct, base64, zlib, math
from collections import defaultdict
root=Path(__file__).resolve().parents[2]
path=root/'src/parts/multicopter-frame-component/lib/additional.json'
frames=json.loads(path.read_text())
def unpack(m,key,fmt):
 data=base64.b64decode(m[key])
 if m.get('meshCompression')=='zlib':data=zlib.decompress(data)
 return list(struct.iter_unpack(fmt,data))
def boundary(v,t):
 counts={}
 for face in t:
  for k in range(3):
   a,b=face[k],face[(k+1)%3];key=tuple(sorted((a,b)))
   n,edge=counts.get(key,(0,(a,b)));counts[key]=(n+1,edge)
 return [edge for n,edge in counts.values() if n==1]
for frame in frames:
 for m in frame['parts']:
  v=unpack(m,'vertices','<fff');t=unpack(m,'triangles','<III')
  if m['id'] in ['source-podracer-v1-02','source-podracer-v1-06']:
   # Weld identical boundary points before adding missing patches.
   points=[];ids=[];seen={}
   for point in v:
    key=tuple(round(x,5) for x in point)
    if key not in seen:seen[key]=len(points);points.append(point)
    ids.append(seen[key])
   v=points;t=[tuple(ids[i] for i in f) for f in t];edges=boundary(v,t)
   if edges and m['sourceIndex']==2:
    assert len(edges)==1008
    # Four analytic 90-degree countersink cone faces return zero triangles in OCC.
    # Both rim loops exist; bridge corresponding angular samples, preserving holes.
    rim=defaultdict(set)
    for a,b in edges:
     for i in [a,b]:
      x,y,z=v[i];cx=10 if x>0 else -10;cy=10 if y>0 else -10
      rim[(cx,cy,round(z))].add(i)
    for cx in [-10,10]:
     for cy in [-10,10]:
      rings=[sorted(rim[(cx,cy,z)],key=lambda i:math.atan2(v[i][1]-cy,v[i][0]-cx)) for z in [0,1]]
      a,b=rings;assert len(a)==len(b)==126
      for k in range(126):
       n=(k+1)%126
       for tri in [(a[k],a[n],b[n]),(a[k],b[n],b[k])]:
        p,q,r=[v[i] for i in tri];u=[q[j]-p[j] for j in range(3)];w=[r[j]-p[j] for j in range(3)]
        normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
        radial=[sum(v[i][j] for i in tri)/3-c for j,c in enumerate([cx,cy])]
        if sum(normal[j]*radial[j] for j in range(2))>0:tri=tuple(reversed(tri))
        t.append(tri)
    m['previewNotes']=['Four source cone faces produce no OCC triangles. Preview bridges their native circular rims; countersink bores and native BRep are preserved.']
   elif edges:
    assert len(edges)==7
    points=sorted(set(i for e in edges for i in e));lo=[min(v[i][k] for i in points) for k in range(3)];hi=[max(v[i][k] for i in points) for k in range(3)]
    assert max(hi[k]-lo[k] for k in range(3))<.31 and hi[2]-lo[2]<.007
    centre=len(v);v.append(tuple(sum(v[i][k] for i in points)/len(points) for k in range(3)))
    t.extend((centre,b,a) for a,b in edges)
    m['previewNotes']=['A seven-edge OCC seam omission smaller than 0.31 x 0.31 x 0.007 mm is closed in the preview only. Native BRep is unchanged.']
   assert not boundary(v,t),m['id']
  m['vertices']=base64.b64encode(zlib.compress(struct.pack('<'+'f'*len(v)*3,*[x for p in v for x in p]))).decode()
  m['triangles']=base64.b64encode(zlib.compress(struct.pack('<'+'I'*len(t)*3,*[x for p in t for x in p]))).decode()
  m['meshCompression']='zlib'
path.write_text(json.dumps(frames,separators=(',',':')))
print('Preview omissions repaired without changing native CAD; mesh buffers compressed.')
