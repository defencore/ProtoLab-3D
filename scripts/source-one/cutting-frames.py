"""Create CAD-matched sheet layouts. Native STEP remains the exact CAM source."""
from pathlib import Path
import json, ezdxf
root=Path(__file__).resolve().parents[2]
frames=json.loads(Path('/tmp/real-frames/contours.json').read_text())
result={}
for frame,parts in frames.items():
 if not parts:continue
 doc=ezdxf.new('R2010');doc.units=4;space=doc.modelspace();x=0
 for part in parts:
  loX,loY,width,height=part['bounds'];layer=part['id']+'_stock_'+str(part['thickness'])+'mm'
  doc.layers.new(layer);attrs={'layer':layer}
  point=lambda v:(v[0]-loX+x,v[1]-loY)
  for e in part['edges']:
   if e['type']=='line':space.add_line(point(e['a']),point(e['b']),dxfattribs=attrs)
   elif e['type']=='circle':space.add_circle(point(e['c']),e['r'],dxfattribs=attrs)
   elif e['type']=='arc':space.add_arc(point(e['c']),e['r'],e['start'],e['end'],dxfattribs=attrs)
   else:space.add_lwpolyline([point(v) for v in e['points']],dxfattribs=attrs)
  space.add_text(part['label']+' | '+str(part['thickness'])+' mm',dxfattribs={'height':2.5,'insert':(x,-7)})
  x+=width+12
 space.add_text(frame+' | GPL-3.0-only | CAD-matched stock; finish countersinks separately',dxfattribs={'height':2.5,'insert':(0,-15)})
 path=Path('/tmp/real-frames')/(frame+'-cutting.dxf');doc.saveas(path)
 audit=doc.audit();assert not audit.errors and not audit.fixes
 result[frame]={'dxf':path.read_text(),'count':len(parts),'curveToleranceMm':.005}
(root/'src/parts/multicopter-frame/lib/cutting-native.json').write_text(json.dumps(result,separators=(',',':')))
print('CAD-matched cutting layouts',[(k,v['count']) for k,v in result.items()])
