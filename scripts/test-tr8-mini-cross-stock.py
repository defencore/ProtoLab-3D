import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,'/Applications/FreeCAD.app/Contents/Resources/lib');sys.path.insert(0,'scripts')
import FreeCAD as App
from tr8_cross_stock import CrossStockGuard
folder=Path('test-results/tr8-quad-actuator');spec={'report':'channel/swept-stock.json','cases':'channel/cases.json','audit':'channel/native-report.json'}
base=CrossStockGuard(folder)._certificate(spec)
assert base['proof']['passed']
controls=[]
for name in ['../verify-tr8-quad-swept-stock.py','arbitrary.py']:
 try:CrossStockGuard(folder)._certificate(dict(spec,verifierScript=name))
 except AssertionError as error:assert str(error)=='Unknown continuous stock verifier.';controls.append(name)
 else:raise AssertionError('Unallowlisted verifier accepted')
report=dict(passed=True,oldDefaultCertificateAccepted=True,oldReportSha256=base['hash'],recomputedOldCrossPairs=base['proof']['checkedCellPairs'],unknownVerifierRejections=controls,guardScriptSha256=hashlib.sha256(Path('scripts/tr8_cross_stock.py').read_bytes()).hexdigest(),freecad='.'.join(App.Version()[:3]))
Path('test-results/tr8-quad-mini-study/guard-verifier-regression.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
