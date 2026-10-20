"""Shared native flat-face extraction for source sheet fabrication layouts."""
import FreeCAD as App, Part
import json, math, base64, zlib
from pathlib import Path

def native(record):
    shape=Part.Shape()
    shape.importBrepFromString(zlib.decompress(base64.b64decode(record['brep'])).decode())
    return shape

def export_sheet_assets(root, frames):
    folder=root/'src/parts/multicopter-frame-component/lib'
    fabrication={};drawings={}
    for frame in frames:
     contours=[]
     for m in frame['parts']:
      if m['route']!='sheet':continue
      s=native(m)
      face=max((f for f in s.Faces if f.findPlane()),key=lambda f:f.Area)
      rotation=App.Rotation(face.normalAt(0,0),App.Vector(0,0,1))
      flat=s.copy();flat.Placement=App.Placement(App.Vector(),rotation).multiply(flat.Placement)
      flatface=face.copy();flatface.Placement=App.Placement(App.Vector(),rotation).multiply(flatface.Placement)
      b=flat.optimalBoundingBox(False,False);yaw,pitch,roll=rotation.toEuler()
      thickness=round(b.ZLength,3)
      # Countersinks remove volume; thickness comes from the oriented stock envelope.
      assert 1 <= thickness <= 6.01,(m['label'],thickness)
      fabrication[m['id']]=dict(rotation=[roll,pitch,yaw],min=[b.XMin,b.YMin,b.ZMin],size=[b.XLength,b.YLength,b.ZLength],thickness=thickness)
      edges=[]
      for wire in flatface.Wires:
       for edge in wire.Edges:
        c=edge.Curve;kind=type(c).__name__;a=edge.valueAt(edge.FirstParameter);z=edge.valueAt(edge.LastParameter)
        if kind=='Line':edges.append(dict(type='line',a=[a.x,a.y],b=[z.x,z.y]))
        elif kind=='Circle':
         center=c.Center
         if abs(edge.Length-2*math.pi*c.Radius)<1e-6:edges.append(dict(type='circle',c=[center.x,center.y],r=c.Radius))
         else:
          start=math.degrees(math.atan2(a.y-center.y,a.x-center.x));end=math.degrees(math.atan2(z.y-center.y,z.x-center.x))
          if c.Axis.z<0:start,end=end,start
          edges.append(dict(type='arc',c=[center.x,center.y],r=c.Radius,start=start,end=end))
        else:edges.append(dict(type='polyline',points=[[v.x,v.y] for v in edge.discretize(Deflection=.005)]))
      contours.append(dict(id=m['id'],label=m['label'],thickness=thickness,edges=edges,bounds=[b.XMin,b.YMin,b.XLength,b.YLength]))
     drawings[frame['id']]=contours
    (folder/'fabrication.json').write_text(json.dumps(fabrication,separators=(',',':')))
    Path('/tmp/real-frames/contours.json').write_text(json.dumps(drawings,separators=(',',':')))
    return len(fabrication)
