import ast,json,sys,time,math
from pathlib import Path
sys.setrecursionlimit(10000)
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib')
import FreeCAD as App,Part
out=Path('test-results/tr8-quad-geared-rocker-lightened-cables');d=json.loads((out/'printed-capture.json').read_text());piece=d['families'][0]['pieces'][0];prefix='scope = _quad_rocker_source(';line=next(x for x in piece['source'].splitlines()if x.startswith(prefix));source=json.loads(line[len(prefix):-1]);started=time.monotonic();events=[]
def stats(s):return{'type':s.ShapeType,'valid':s.isValid(),'closed':s.isClosed(),'solids':len(s.Solids),'volume':s.Volume,'bounds':[s.BoundBox.XMin,s.BoundBox.XMax,s.BoundBox.YMin,s.BoundBox.YMax,s.BoundBox.ZMin,s.BoundBox.ZMax]}
def world(s):
 t=s.copy()
 for axis,angle in zip([App.Vector(1,0,0),App.Vector(0,1,0),App.Vector(0,0,1)],piece['placement']['rotation']):
  if angle:t.rotate(App.Vector(),axis,angle)
 t.translate(App.Vector(*piece['placement']['translation']));return t
class Trace(ast.NodeTransformer):
 def __init__(self):self.index=0
 def visit_Call(self,node):
  self.generic_visit(node)
  if isinstance(node.func,ast.Attribute)and node.func.attr in['cut','fuse','common']and len(node.args)==1:
   self.index+=1;return ast.copy_location(ast.Call(func=ast.Name(id='_checked',ctx=ast.Load()),args=[node.func.value,ast.Constant(node.func.attr),node.args[0],ast.Constant(self.index),ast.Constant(ast.unparse(node.args[0])[:1500])],keywords=[]),node)
  return node
counter=0
def _checked(left,method,right,index,expression):
 global counter
 counter+=1;result=getattr(left,method)(right)
 if left.Solids and right.Solids and not result.isNull():
  bad=(not result.isValid()) or (left.isClosed() and not result.isClosed());split=False
  if bad or split:
   data={'failure':'invalid or first closed-to-open transition'if bad else'first main-body split','index':index,'runtimeOperation':counter,'method':method,'rightExpression':expression,'before':stats(left),'tool':stats(right),'after':stats(result),'worldTool':stats(world(right)),'elapsedSeconds':time.monotonic()-started}
   (out/'first-failing-cover-cut.json').write_text(json.dumps(data,indent=2)+'\n');world(left).exportBrep(str(out/'failing-prefix-before.brep'));world(right).exportBrep(str(out/'failing-cutter.brep'));world(result).exportBrep(str(out/'failing-prefix-after.brep'));print(json.dumps(data),flush=True);raise RuntimeError('First failing actual cover Boolean saved')
 if counter%25==0:print('operation '+str(counter)+' valid',flush=True)
 return result
module=Trace().visit(ast.parse(source));ast.fix_missing_locations(module)
try:exec(compile(module,'<traced-public-cover>','exec'),{'App':App,'Part':Part,'math':math,'_checked':_checked})
except BaseException as e:print(str(e),flush=True);raise
